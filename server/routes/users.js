/**
 * Роуты управления пользователями (оптимизированная версия)
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const dbUtils = require('../utils/dbUtils');
const apiResponse = require('../middleware/apiResponse');

/**
 * Получение списка пользователей
 */
router.get('/', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  logger.info('ADMIN', 'Запрос списка пользователей');
  
  const { data: users, error } = await supabase
    .from('users')
    .select('id, yandex_id, first_name, last_name, display_name, avatar_url, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return apiResponse.sendError(res, error, {
      statusCode: 500,
      code: 'DB_ERROR',
      operation: 'получение пользователей'
    });
  }

  // Получаем количество видео для каждого пользователя
  const userIds = Array.isArray(users) ? users.map(u => u.id) : [];
  const videosCounts = await dbUtils.getVideoCountsByUsers(userIds);

  // Обрабатываем данные
  const processedUsers = Array.isArray(users) ? users.map(user => ({
    ...user,
    videosCount: videosCounts[user.id] || 0
  })) : [];

  logger.success('ADMIN', 'Получены пользователи');
  apiResponse.sendSuccess(res, { users: processedUsers });
}));

/**
 * Поиск пользователей с фильтрацией
 */
router.get('/search', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { query, sortBy = 'created_at', order = 'desc', limit = 50, offset = 0 } = req.query;
  
  logger.info('ADMIN', 'Поиск пользователей', { query, sortBy, order, limit, offset });

  let queryBuilder = supabase.from('users').select(
    'id, yandex_id, first_name, last_name, display_name, avatar_url, created_at',
    { count: 'exact' }
  );

  // Фильтр по поиску
  if (query) {
    queryBuilder = queryBuilder.or(
      `display_name.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,yandex_id.ilike.%${query}%`
    );
  }

  // Сортировка и пагинация
  const ascending = order === 'asc';
  queryBuilder = queryBuilder
    .order(sortBy, { ascending })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  const { data: users, error, count } = await queryBuilder;

  if (error) {
    return apiResponse.sendError(res, error, {
      statusCode: 500,
      code: 'DB_ERROR',
      operation: 'поиск пользователей'
    });
  }

  // Получаем количество видео для каждого пользователя
  const userIds = Array.isArray(users) ? users.map(u => u.id) : [];
  const videosCounts = await dbUtils.getVideoCountsByUsers(userIds);

  const processedUsers = Array.isArray(users) ? users.map(user => ({
    ...user,
    videosCount: videosCounts[user.id] || 0
  })) : [];

  apiResponse.sendSuccess(res, apiResponse.formatPaginatedResponse(
    processedUsers,
    count,
    parseInt(limit),
    parseInt(offset)
  ));
}));

/**
 * Удаление пользователя и всех его данных
 */
router.delete('/:id', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const userId = req.params.id;
  
  logger.info('ADMIN', 'Удаление пользователя', { userId });

  // Получаем информацию о пользователе
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('id', userId)
    .single();

  if (fetchError || !user) {
    logger.warn('ADMIN', 'Пользователь не найден', { userId });
    return apiResponse.sendError(res, 'Пользователь не найден', {
      statusCode: 404,
      code: 'NOT_FOUND',
      operation: 'получение пользователя'
    });
  }

  // Получаем все видео пользователя
  const { data: userVideos, error: videosError } = await supabase
    .from('videos')
    .select('id')
    .eq('user_id', userId);

  if (videosError) {
    logger.error('ADMIN', 'Ошибка получения видео пользователя', videosError);
    return apiResponse.sendError(res, videosError, {
      statusCode: 500,
      code: 'DB_ERROR',
      operation: 'получение видео пользователя'
    });
  }

  // Если есть видео, удаляем их с очисткой тегов
  let deletedVideosCount = 0;
  let updatedTagsCount = 0;

  if (Array.isArray(userVideos) && userVideos.length > 0) {
    const videoIds = userVideos.map(v => v.id);
    const result = await dbUtils.deleteVideosWithTagCleanup(videoIds);
    deletedVideosCount = result.deletedCount;
    updatedTagsCount = result.updatedTags;
  }

  // Удаляем пользователя
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (deleteError) {
    logger.error('ADMIN', 'Ошибка удаления пользователя', deleteError);
    return apiResponse.sendError(res, deleteError, {
      statusCode: 500,
      code: 'DB_ERROR',
      operation: 'удаление пользователя'
    });
  }

  logger.success('ADMIN', 'Пользователь удален', { 
    userId, 
    userName: user.display_name,
    deletedVideos: deletedVideosCount
  });

  apiResponse.sendSuccess(res, {
    message: 'Пользователь успешно удален',
    userName: user.display_name,
    deletedVideos: deletedVideosCount,
    updatedTags: updatedTagsCount
  });
}));

module.exports = router;

