/**
 * Роуты для работы с видео
 * Объединяет функции для обычных пользователей и администраторов
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config/environment');
const logger = require('../utils/logger');
const { validateFile, requireAuth, requireAdmin } = require('../middleware/unified');
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

// ==================== АДМИНИСТРАТОРСКИЕ ФУНКЦИИ ====================

/**
 * Получение списка видео (для администраторов)
 */
router.get('/admin', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  logger.info('ADMIN', 'Запрос списка видео');
  
  const { data: videos, error } = await supabase
    .from('videos')
    .select(`
      id, user_id, description, video_url,
      latitude, longitude, likes_count, views_count,
      created_at,
      users (id, yandex_id, display_name, avatar_url)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return apiResponse.sendError(res, error, {
      statusCode: 500,
      code: 'DB_ERROR',
      operation: 'получение видео'
    });
  }

  logger.success('ADMIN', 'Получены видео');
  apiResponse.sendSuccess(res, { videos: videos || [] });
}));

/**
 * Поиск видео с фильтрацией (для администраторов)
 */
router.get('/admin/search', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { 
    query, userId, sortBy = 'created_at', order = 'desc', 
    limit = 50, offset = 0, minViews, minLikes
  } = req.query;
  
  logger.info('ADMIN', 'Поиск видео', { query, userId, sortBy, order, limit, offset });

  let queryBuilder = supabase.from('videos').select(`
    id, user_id, description, video_url, latitude, longitude,
    likes_count, views_count, created_at,
    users (id, yandex_id, display_name, avatar_url)
  `, { count: 'exact' });

  // Применяем фильтры
  if (query) {
    queryBuilder = queryBuilder.ilike('description', `%${query}%`);
  }
  if (userId) {
    queryBuilder = queryBuilder.eq('user_id', userId);
  }
  if (minViews) {
    queryBuilder = queryBuilder.gte('views_count', parseInt(minViews));
  }
  if (minLikes) {
    queryBuilder = queryBuilder.gte('likes_count', parseInt(minLikes));
  }

  // Сортировка и пагинация
  const ascending = order === 'asc';
  queryBuilder = queryBuilder
    .order(sortBy, { ascending })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  const { data: videos, error, count } = await queryBuilder;

  if (error) {
    return apiResponse.sendError(res, error, {
      statusCode: 500,
      code: 'DB_ERROR',
      operation: 'поиск видео'
    });
  }

  apiResponse.sendSuccess(res, apiResponse.formatPaginatedResponse(
    videos || [],
    count,
    parseInt(limit),
    parseInt(offset)
  ));
}));

/**
 * Удаление видео администратором
 */
router.delete('/admin/:id', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const videoId = req.params.id;
  logger.info('ADMIN', 'Удаление видео', { videoId });

  // Используем общую функцию удаления с очисткой тегов
  const result = await dbUtils.deleteVideosWithTagCleanup(videoId);

  if (!result.success) {
    return apiResponse.sendError(res, 'Ошибка удаления видео', {
      statusCode: 500,
      code: 'DB_ERROR'
    });
  }

  logger.info('ADMIN', 'Видео удалено', { videoId, tagsUpdated: result.updatedTags });
  apiResponse.sendSuccess(res, { 
    message: 'Видео успешно удалено',
    tagsUpdated: result.updatedTags
  });
}));

/**
 * Массовое удаление видео (для администратора)
 */
router.delete('/admin/bulk', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { videoIds } = req.body;
  
  if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
    return apiResponse.sendError(res, 'Необходимо предоставить массив ID видео', {
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
  }
  
  logger.info('ADMIN', 'Массовое удаление видео', { count: videoIds.length });
  
  // Используем общую функцию удаления
  const result = await dbUtils.deleteVideosWithTagCleanup(videoIds);

  logger.success('ADMIN', 'Видео удалены', { 
    count: result.deletedCount, 
    tagsUpdated: result.updatedTags 
  });

  apiResponse.sendSuccess(res, {
    message: 'Видео успешно удалены',
    count: result.deletedCount,
    tagsUpdated: result.updatedTags
  });
}));

module.exports = router;

