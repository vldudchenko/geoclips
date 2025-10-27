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

  
  // Получаем информацию о видео
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single();

  if (videoError || !video) {    
    return apiResponse.sendError(res, 'Видео не найдено', {
      statusCode: 404,
      code: 'NOT_FOUND'
    });
  }

  // Проверяем, что пользователь является владельцем видео
  if (video.user_id !== currentUserId) {    
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

  
  // Проверяем, что пользователь является владельцем видео
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('user_id')
    .eq('id', videoId)
    .single();

  if (videoError || !video) {    
    return apiResponse.sendError(res, 'Видео не найдено', {
      statusCode: 404,
      code: 'NOT_FOUND'
    });
  }

  if (video.user_id !== currentUserId) {    
    return apiResponse.sendError(res, 'Недостаточно прав для добавления тегов', {
      statusCode: 403,
      code: 'FORBIDDEN'
    });
  }

  // Привязываем теги к видео
  const result = await dbUtils.assignTagsToVideo(videoId, tags, currentUserId);

  
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

  
  // Проверяем, что пользователь является владельцем видео
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('user_id')
    .eq('id', videoId)
    .single();

  if (videoError || !video) {    
    return apiResponse.sendError(res, 'Видео не найдено', {
      statusCode: 404,
      code: 'NOT_FOUND'
    });
  }

  if (video.user_id !== currentUserId) {    
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

  
  apiResponse.sendSuccess(res, {
    message: 'Тег успешно удален'
  });
}));

// ==================== АДМИНИСТРАТОРСКИЕ ФУНКЦИИ ====================

/**
 * Получение списка видео (для администраторов)
 */
router.get('/admin', requireAdmin, apiResponse.asyncHandler(async (req, res) => {  
  
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
  
  // Используем общую функцию удаления с очисткой тегов
  const result = await dbUtils.deleteVideosWithTagCleanup(videoId);

  if (!result.success) {
    return apiResponse.sendError(res, 'Ошибка удаления видео', {
      statusCode: 500,
      code: 'DB_ERROR'
    });
  }
  
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
  
    
  // Используем общую функцию удаления
  const result = await dbUtils.deleteVideosWithTagCleanup(videoIds);
  
  apiResponse.sendSuccess(res, {
    message: 'Видео успешно удалены',
    count: result.deletedCount,
    tagsUpdated: result.updatedTags
  });
}));

/**
 * Получение тегов видео (для администратора)
 */
router.get('/admin/:id/tags', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    const { data: videoTags, error } = await supabase
      .from('video_tags')
      .select(`
        video_id,
        tag_id,
        tags (
          id,
          name,
          usage_count
        )
      `)
      .eq('video_id', id);
    
    if (error) {
      logger.error('VIDEO', 'Ошибка получения тегов видео', error);
      return apiResponse.sendError(res, 'Ошибка получения тегов видео', {
        statusCode: 500,
        code: 'DATABASE_ERROR'
      });
    }
    
    const tags = videoTags.map(vt => vt.tags).filter(Boolean);
    
    apiResponse.sendSuccess(res, { tags });
  } catch (error) {
    logger.error('VIDEO', 'Ошибка получения тегов видео', error);
    apiResponse.sendError(res, 'Ошибка получения тегов видео', {
      statusCode: 500,
      code: 'INTERNAL_ERROR'
    });
  }
}));

/**
 * Обновление тегов видео (для администратора)
 */
router.put('/admin/:id/tags', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tagIds, tagNames } = req.body;
  
  logger.info('VIDEO', 'Обновление тегов видео', { 
    videoId: id, 
    tagIds, 
    tagNames, 
    userId: req.user?.dbUser?.id 
  });
  
  // Поддерживаем как tagIds (массив ID), так и tagNames (массив названий)
  if (!Array.isArray(tagIds) && !Array.isArray(tagNames)) {
    logger.warn('VIDEO', 'Неверные параметры запроса', { tagIds, tagNames });
    return apiResponse.sendError(res, 'Необходимо передать tagIds или tagNames', {
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
  }
  
  try {
    // Проверяем, что видео существует
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, user_id')
      .eq('id', id)
      .single();
    
    if (videoError || !video) {
      return apiResponse.sendError(res, 'Видео не найдено', {
        statusCode: 404,
        code: 'NOT_FOUND'
      });
    }
    
    // Удаляем существующие связи
    const { error: deleteError } = await supabase
      .from('video_tags')
      .delete()
      .eq('video_id', id);
    
    if (deleteError) {
      logger.error('VIDEO', 'Ошибка удаления старых тегов', deleteError);
      return apiResponse.sendError(res, 'Ошибка удаления старых тегов', {
        statusCode: 500,
        code: 'DATABASE_ERROR'
      });
    }
    
    let result = { assigned: 0, created: 0, skipped: 0 };
    
    // Если переданы названия тегов, используем assignTagsToVideo
    if (tagNames && tagNames.length > 0) {
      result = await dbUtils.assignTagsToVideo(id, tagNames, req.user?.dbUser?.id);
    } 
    // Если переданы ID тегов, добавляем связи напрямую
    else if (tagIds && tagIds.length > 0) {
      logger.info('VIDEO', 'Добавляем теги по ID', { videoId: id, tagIds });
      
      const videoTags = tagIds.map(tagId => ({
        video_id: id,
        tag_id: tagId
      }));
      
      logger.info('VIDEO', 'Данные для вставки', { videoTags });
      
      const { data: insertedData, error: insertError } = await supabase
        .from('video_tags')
        .insert(videoTags)
        .select();
      
      if (insertError) {
        logger.error('VIDEO', 'Ошибка добавления новых тегов', insertError);
        return apiResponse.sendError(res, 'Ошибка добавления новых тегов', {
          statusCode: 500,
          code: 'DATABASE_ERROR'
        });
      }
      
      logger.info('VIDEO', 'Теги успешно добавлены', { insertedData });
      result.assigned = tagIds.length;
    }
    
    // Обновляем счетчики тегов
    await dbUtils.updateTagCounters();
    
    logger.info('VIDEO', `Теги обновлены для видео ${id}`, { tagIds, tagNames, result });
    
    apiResponse.sendSuccess(res, {
      message: 'Теги успешно обновлены',
      tagIds: tagIds || [],
      tagNames: tagNames || [],
      result
    });
  } catch (error) {
    logger.error('VIDEO', 'Ошибка обновления тегов видео', error);
    apiResponse.sendError(res, 'Ошибка обновления тегов видео', {
      statusCode: 500,
      code: 'INTERNAL_ERROR'
    });
  }
}));

module.exports = router;

