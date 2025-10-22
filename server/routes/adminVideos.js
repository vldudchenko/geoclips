/**
 * Роуты управления видео в админке (оптимизированная версия)
 * Специфичные для администраторов функции: просмотр, поиск, удаление, массовые операции
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const dbUtils = require('../utils/dbUtils');
const apiResponse = require('../middleware/apiResponse');

/**
 * Получение списка видео
 */
router.get('/', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
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
 * Поиск видео с фильтрацией
 */
router.get('/search', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
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
 * Удаление одного видео (для администратора)
 */
router.delete('/:id', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
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
router.delete('/bulk', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
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

