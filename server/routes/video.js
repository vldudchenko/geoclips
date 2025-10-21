/**
 * Роуты для работы с видео
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config/environment');
const logger = require('../utils/logger');
const { validateFile } = require('../middleware/validation');
const { requireAuth } = require('../middleware/auth');
const supabase = require('../config/supabase');

// Настройка multer для загрузки файлов
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1,
    fieldSize: config.upload.maxFieldSize
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/quicktime',
      'video/x-quicktime',
      'video/wmv',
      'video/webm',
      'video/3gpp',
      'video/x-msvideo'
    ];

    const allowedExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.3gp'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    const hasValidExtension = allowedExtensions.includes(fileExtension);
    const hasValidMimeType = allowedTypes.includes(file.mimetype);

    logger.debug('VIDEO', 'Проверка типа файла', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      extension: fileExtension,
      valid: hasValidMimeType || hasValidExtension
    });

    if (hasValidMimeType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error(`Неподдерживаемый тип файла: ${file.mimetype}`), false);
    }
  }
});

/**
 * Генерация превью видео
 */
router.post('/generate-thumbnail', upload.single('video'), validateFile('video'), async (req, res) => {
  try {
    const inputPath = req.file.path;
    const thumbnailPath = path.join('uploads/thumbnails', `${req.file.filename}.jpg`);

    logger.loading('VIDEO', 'Генерация превью', { file: req.file.originalname });

    // Генерируем превью на 2 секунде
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: ['2'],
          filename: `${req.file.filename}.jpg`,
          folder: 'uploads/thumbnails',
          size: '320x240'
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Удаляем временный файл
    await fs.unlink(inputPath);

    logger.success('VIDEO', 'Превью успешно создано');
    res.json({
      success: true,
      thumbnailPath: `/uploads/thumbnails/${req.file.filename}.jpg`
    });

  } catch (error) {
    logger.error('VIDEO', 'Ошибка генерации превью', error);
    res.status(500).json({ error: 'Ошибка генерации превью' });
  }
});

/**
 * Валидация видео
 */
router.post('/validate-video', upload.single('video'), validateFile('video'), async (req, res) => {
  try {
    const inputPath = req.file.path;
    let duration = 0;
    let isValid = true;
    let errorMessage = '';

    logger.loading('VIDEO', 'Валидация видео', { file: req.file.originalname });

    // Получаем информацию о видео
    await new Promise((resolve) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          errorMessage = 'Не удалось обработать видео файл';
          isValid = false;
        } else {
          duration = metadata.format.duration;
          if (duration > 60) {
            errorMessage = 'Длительность видео не должна превышать 60 секунд';
            isValid = false;
          }
        }
        resolve();
      });
    });

    // Удаляем временный файл
    await fs.unlink(inputPath);

    logger.info('VIDEO', 'Результат валидации', { isValid, duration });

    res.json({
      isValid,
      duration,
      errorMessage: isValid ? null : errorMessage,
      fileSize: req.file.size
    });

  } catch (error) {
    logger.error('VIDEO', 'Ошибка валидации видео', error);
    res.status(500).json({ error: 'Ошибка валидации видео' });
  }
});

/**
 * Удаление видео
 */
router.delete('/:videoId', requireAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const currentUserId = req.user?.dbUser?.id;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Пользователь не авторизован' });
    }

    logger.loading('VIDEO', 'Удаление видео', { videoId, userId: currentUserId });

    // Получаем информацию о видео
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      logger.warn('VIDEO', 'Видео не найдено', { videoId });
      return res.status(404).json({ error: 'Видео не найдено' });
    }

    // Проверяем, что пользователь является владельцем видео
    if (video.user_id !== currentUserId) {
      logger.warn('VIDEO', 'Попытка удаления чужого видео', { 
        videoId, 
        ownerId: video.user_id, 
        currentUserId 
      });
      return res.status(403).json({ error: 'Недостаточно прав для удаления видео' });
    }

    // Удаляем связанные теги
    const { error: tagsError } = await supabase
      .from('video_tags')
      .delete()
      .eq('video_id', videoId);

    if (tagsError) {
      logger.error('VIDEO', 'Ошибка удаления тегов видео', tagsError);
    }

    // Удаляем видео из базы данных
    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId);

    if (deleteError) {
      logger.error('VIDEO', 'Ошибка удаления видео из БД', deleteError);
      return res.status(500).json({ error: 'Ошибка удаления видео' });
    }

    // Удаляем файлы видео и превью (если есть)
    try {
      if (video.video_url) {
        // Извлекаем путь к файлу из URL
        const videoPath = video.video_url.replace(`${config.baseUrl}/uploads/videos/`, 'uploads/videos/');
        try {
          await fs.unlink(videoPath);
          logger.success('VIDEO', 'Файл видео удален', { videoPath });
        } catch (unlinkError) {
          logger.warn('VIDEO', 'Не удалось удалить файл видео', { videoPath, error: unlinkError.message });
        }
      }

    } catch (fileError) {
      logger.warn('VIDEO', 'Ошибка удаления файлов', fileError);
      // Не возвращаем ошибку, так как видео уже удалено из БД
    }

    logger.success('VIDEO', 'Видео успешно удалено', { videoId });
    res.json({ 
      success: true, 
      message: 'Видео успешно удалено' 
    });

  } catch (error) {
    logger.error('VIDEO', 'Ошибка удаления видео', error);
    res.status(500).json({ error: 'Ошибка сервера при удалении видео' });
  }
});

module.exports = router;

