/**
 * Роуты управления пользователями (оптимизированная версия)
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/unified');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const dbUtils = require('../utils/dbUtils');
const apiResponse = require('../middleware/apiResponse');

/**
 * Получение списка пользователей
 */
router.get('/', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  
  logger.info('ADMIN', 'Начинаем загрузку пользователей');
  
  const { data: users, error } = await supabase
    .from('users')
    .select('id, yandex_id, first_name, last_name, display_name, avatar_url, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('ADMIN', 'Ошибка получения пользователей', error);
    return apiResponse.sendError(res, error, {
      statusCode: 500,
      code: 'DB_ERROR',
      operation: 'получение пользователей'
    });
  }

  logger.info('ADMIN', 'Пользователи получены', { 
    count: users?.length || 0,
    firstUser: users?.[0] ? { id: users[0].id, name: users[0].display_name } : null
  });

  // Получаем расширенную статистику для каждого пользователя
  const userIds = Array.isArray(users) ? users.map(u => u.id) : [];
  
  logger.info('ADMIN', 'Загружаем статистику пользователей', { 
    usersCount: users?.length || 0, 
    userIds: userIds.slice(0, 3) 
  });
  
  const [
    videosCounts,
    commentsWritten,
    commentsReceived,
    likesGiven,
    likesReceived,
    tagsCreated,
    tagsUsed
  ] = await Promise.all([
    dbUtils.getVideoCountsByUsers(userIds),
    dbUtils.getCommentsWrittenByUsers(userIds),
    dbUtils.getCommentsReceivedByUsers(userIds),
    dbUtils.getLikesGivenByUsers(userIds),
    dbUtils.getLikesReceivedByUsers(userIds),
    dbUtils.getTagsCountsByUsers(userIds),
    dbUtils.getTagsUsedByUsers(userIds)
  ]);

  logger.info('ADMIN', 'Статистика загружена', {
    videosCounts: Object.keys(videosCounts).length,
    commentsWritten: Object.keys(commentsWritten).length,
    commentsReceived: Object.keys(commentsReceived).length,
    likesGiven: Object.keys(likesGiven).length,
    likesReceived: Object.keys(likesReceived).length,
    tagsCreated: Object.keys(tagsCreated).length,
    tagsUsed: Object.keys(tagsUsed).length
  });

  // Обрабатываем данные
  const processedUsers = Array.isArray(users) ? users.map(user => ({
    ...user,
    videosCount: videosCounts[user.id] || 0,
    commentsWritten: commentsWritten[user.id] || 0,
    commentsReceived: commentsReceived[user.id] || 0,
    likesGiven: likesGiven[user.id] || 0,
    likesReceived: likesReceived[user.id] || 0,
    tagsCreated: tagsCreated[user.id] || 0,
    tagsUsed: tagsUsed[user.id] || 0,
    // Обратная совместимость
    commentsCount: commentsWritten[user.id] || 0,
    likeCount: likesReceived[user.id] || 0,
    tagsCount: tagsCreated[user.id] || 0
  })) : [];

  logger.info('ADMIN', 'Данные обработаны', {
    processedUsers: processedUsers.length,
    sampleUser: processedUsers[0] ? {
      id: processedUsers[0].id,
      videosCount: processedUsers[0].videosCount,
      commentsWritten: processedUsers[0].commentsWritten,
      likesGiven: processedUsers[0].likesGiven,
      tagsCreated: processedUsers[0].tagsCreated
    } : null
  });

  apiResponse.sendSuccess(res, { 
    users: processedUsers,
    total: processedUsers.length 
  });
}));

/**
 * Поиск пользователей с фильтрацией
 */
router.get('/search', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { query, sortBy = 'created_at', order = 'desc', limit = 50, offset = 0 } = req.query;
  

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

  const paginatedResponse = apiResponse.formatPaginatedResponse(
    processedUsers,
    count,
    parseInt(limit),
    parseInt(offset)
  );
  
  apiResponse.sendSuccess(res, { 
    users: paginatedResponse.data,
    total: paginatedResponse.pagination.total,
    pagination: paginatedResponse.pagination
  });
}));

/**
 * Удаление пользователя и всех его данных
 */
router.delete('/:id', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const userId = req.params.id;
  

  // Получаем информацию о пользователе
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('id', userId)
    .single();

  if (fetchError || !user) {
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


  apiResponse.sendSuccess(res, {
    message: 'Пользователь успешно удален',
    userName: user.display_name,
    deletedVideos: deletedVideosCount,
    updatedTags: updatedTagsCount
  });
}));

module.exports = router;

