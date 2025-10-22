/**
 * Роуты для работы с видео (для обычных пользователей)
 * Функции: загрузка, валидация, удаление своих видео
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
const dbUtils = require('../utils/dbUtils');
const apiResponse = require('../middleware/apiResponse');

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
      'video/mp4', 'video/avi', 'video/mov', 'video/quicktime',
      'video/x-quicktime', 'video/wmv', 'video/webm', 'video/3gpp',
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
 * Валидация видео перед загрузкой
 */
router.post('/validate-video', upload.single('video'), validateFile('video'), 
  apiResponse.asyncHandler(async (req, res) => {
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

    apiResponse.sendSuccess(res, {
      isValid,
      duration,
      errorMessage: isValid ? null : errorMessage,
      fileSize: req.file.size
    });
  })
);

/**
 * Удаление видео пользователя (проверка владельца)
 */
router.delete('/:videoId', requireAuth, apiResponse.asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const currentUserId = req.user?.dbUser?.id;

  if (!currentUserId) {
    return apiResponse.sendError(res, 'Пользователь не авторизован', {
      statusCode: 401,
      code: 'UNAUTHORIZED'
    });
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
    return apiResponse.sendError(res, 'Видео не найдено', {
      statusCode: 404,
      code: 'NOT_FOUND'
    });
  }

  // Проверяем, что пользователь является владельцем видео
  if (video.user_id !== currentUserId) {
    logger.warn('VIDEO', 'Попытка удаления чужого видео', { 
      videoId, 
      ownerId: video.user_id, 
      currentUserId 
    });
    return apiResponse.sendError(res, 'Недостаточно прав для удаления видео', {
      statusCode: 403,
      code: 'FORBIDDEN'
    });
  }

  // Используем общую функцию удаления видео с очисткой тегов
  const result = await dbUtils.deleteVideosWithTagCleanup(videoId);

  if (!result.success) {
    return apiResponse.sendError(res, 'Ошибка удаления видео', {
      statusCode: 500,
      code: 'DB_ERROR'
    });
  }

  // Удаляем файлы видео
  try {
    if (video.video_url) {
      const videoPath = video.video_url.replace(`${config.baseUrl}/uploads/videos/`, 'uploads/videos/');
      try {
        await fs.unlink(videoPath);
        logger.success('VIDEO', 'Файл видео удален', { videoPath });
      } catch (unlinkError) {
        logger.warn('VIDEO', 'Не удалось удалить файл видео', { 
          videoPath, 
          error: unlinkError.message 
        });
      }
    }
  } catch (fileError) {
    logger.warn('VIDEO', 'Ошибка удаления файлов', fileError);
  }

  logger.success('VIDEO', 'Видео успешно удалено', { videoId, tagsUpdated: result.updatedTags });
  
  apiResponse.sendSuccess(res, {
    message: 'Видео успешно удалено',
    tagsUpdated: result.updatedTags
  });
}));

/**
 * Получить теги видео
 */
router.get('/:videoId/tags', apiResponse.asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  logger.info('VIDEO', 'Получение тегов видео', { videoId });

  const tags = await dbUtils.getVideoTags(videoId);

  apiResponse.sendSuccess(res, { tags });
}));

/**
 * Привязать теги к видео (только для владельца)
 */
router.post('/:videoId/tags', requireAuth, apiResponse.asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { tags } = req.body;
  const currentUserId = req.user?.dbUser?.id;

  if (!currentUserId) {
    return apiResponse.sendError(res, 'Пользователь не авторизован', {
      statusCode: 401,
      code: 'UNAUTHORIZED'
    });
  }

  if (!Array.isArray(tags) || tags.length === 0) {
    return apiResponse.sendError(res, 'Необходимо передать массив тегов', {
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
  }

  logger.info('VIDEO', 'Привязка тегов к видео', { videoId, tagCount: tags.length, userId: currentUserId });

  // Проверяем, что пользователь является владельцем видео
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('user_id')
    .eq('id', videoId)
    .single();

  if (videoError || !video) {
    logger.warn('VIDEO', 'Видео не найдено', { videoId });
    return apiResponse.sendError(res, 'Видео не найдено', {
      statusCode: 404,
      code: 'NOT_FOUND'
    });
  }

  if (video.user_id !== currentUserId) {
    logger.warn('VIDEO', 'Попытка добавления тегов к чужому видео', {
      videoId,
      ownerId: video.user_id,
      currentUserId
    });
    return apiResponse.sendError(res, 'Недостаточно прав для добавления тегов', {
      statusCode: 403,
      code: 'FORBIDDEN'
    });
  }

  // Привязываем теги к видео
  const result = await dbUtils.assignTagsToVideo(videoId, tags, currentUserId);

  logger.success('VIDEO', 'Теги привязаны к видео', {
    videoId,
    assigned: result.assigned,
    skipped: result.skipped
  });

  apiResponse.sendSuccess(res, {
    message: 'Теги успешно привязаны',
    assigned: result.assigned,
    skipped: result.skipped,
    errors: result.errors
  });
}));

/**
 * Удалить тег у видео (только для владельца)
 */
router.delete('/:videoId/tags/:tagId', requireAuth, apiResponse.asyncHandler(async (req, res) => {
  const { videoId, tagId } = req.params;
  const currentUserId = req.user?.dbUser?.id;

  if (!currentUserId) {
    return apiResponse.sendError(res, 'Пользователь не авторизован', {
      statusCode: 401,
      code: 'UNAUTHORIZED'
    });
  }

  logger.info('VIDEO', 'Удаление тега у видео', { videoId, tagId, userId: currentUserId });

  // Проверяем, что пользователь является владельцем видео
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('user_id')
    .eq('id', videoId)
    .single();

  if (videoError || !video) {
    logger.warn('VIDEO', 'Видео не найдено', { videoId });
    return apiResponse.sendError(res, 'Видео не найдено', {
      statusCode: 404,
      code: 'NOT_FOUND'
    });
  }

  if (video.user_id !== currentUserId) {
    logger.warn('VIDEO', 'Попытка удаления тега у чужого видео', {
      videoId,
      ownerId: video.user_id,
      currentUserId
    });
    return apiResponse.sendError(res, 'Недостаточно прав для удаления тега', {
      statusCode: 403,
      code: 'FORBIDDEN'
    });
  }

  // Удаляем связь видео-тег
  const { error: deleteError } = await supabase
    .from('video_tags')
    .delete()
    .eq('video_id', videoId)
    .eq('tag_id', tagId);

  if (deleteError) {
    logger.error('VIDEO', 'Ошибка удаления тега у видео', { videoId, tagId, error: deleteError });
    return apiResponse.sendError(res, 'Ошибка удаления тега', {
      statusCode: 500,
      code: 'DB_ERROR'
    });
  }

  // Уменьшаем счетчик использования тега
  const { data: tag } = await supabase
    .from('tags')
    .select('usage_count')
    .eq('id', tagId)
    .single();

  if (tag) {
    await supabase
      .from('tags')
      .update({ usage_count: Math.max(0, (tag.usage_count || 1) - 1) })
      .eq('id', tagId);
  }

  logger.success('VIDEO', 'Тег удален у видео', { videoId, tagId });

  apiResponse.sendSuccess(res, {
    message: 'Тег успешно удален'
  });
}));

module.exports = router;

