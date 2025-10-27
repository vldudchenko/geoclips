/**
 * Роуты управления тегами (оптимизированная версия)
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/unified');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const dbUtils = require('../utils/dbUtils');
const apiResponse = require('../middleware/apiResponse');

// Логируем регистрацию маршрутов
console.log('Tags routes registered: GET /, POST /, DELETE /bulk, DELETE /:id, POST /fix-counters');

/**
 * Получение списка тегов
 */
router.get('/', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { search, sortBy = 'name', order = 'asc', limit, offset } = req.query;
  
  let queryBuilder = supabase
    .from('tags')
    .select('id, name, usage_count, user_id, created_at', { count: 'exact' });

  // Применяем поиск, если указан
  if (search && search.trim()) {
    queryBuilder = queryBuilder.ilike('name', `%${search.trim()}%`);
  }

  // Сортировка
  const ascending = order === 'asc';
  queryBuilder = queryBuilder.order(sortBy, { ascending });

  // Пагинация
  if (limit && offset) {
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);
    queryBuilder = queryBuilder.range(offsetNum, offsetNum + limitNum - 1);
  }

  const { data: tags, error, count } = await queryBuilder;

  if (error) {
    return apiResponse.sendError(res, error, {
      statusCode: 500,
      code: 'DB_ERROR',
      operation: 'получение тегов'
    });
  }

  // Получаем информацию о пользователях-создателях тегов
  const userIds = [...new Set(tags?.filter(tag => tag.user_id).map(tag => tag.user_id))];
  let usersMap = {};
  
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', userIds);
    
    if (!usersError && users) {
      usersMap = users.reduce((map, user) => {
        map[user.id] = user.display_name;
        return map;
      }, {});
    }
  }

  // Добавляем информацию о создателе к каждому тегу
  const tagsWithCreator = tags?.map(tag => ({
    ...tag,
    creator_name: tag.user_id ? usersMap[tag.user_id] || 'Неизвестно' : 'Система'
  })) || [];

  // Если есть пагинация, возвращаем с метаданными
  if (limit && offset) {
    apiResponse.sendSuccess(res, apiResponse.formatPaginatedResponse(
      tagsWithCreator,
      count,
      parseInt(limit),
      parseInt(offset)
    ));
  } else {
    apiResponse.sendSuccess(res, { tags: tagsWithCreator });
  }
}));

/**
 * Создание нового тега
 */
router.post('/', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { name } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return apiResponse.sendError(res, 'Название тега обязательно', {
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
  }
  
  const tagName = name.trim();
  
  if (tagName.length > 50) {
    return apiResponse.sendError(res, 'Название тега не должно превышать 50 символов', {
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
  }
  
  
  try {
    // Получаем ID пользователя из сессии (если есть)
    const userId = req.user?.dbUser?.id || null;
    
    // Используем функцию из dbUtils для создания тега
    const tag = await dbUtils.getOrCreateTag(tagName, userId);
    
    
    apiResponse.sendSuccess(res, {
      message: 'Тег успешно создан',
      tag: tag
    });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка создания тега', { name: tagName, error: error.message });
    
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return apiResponse.sendError(res, 'Тег с таким названием уже существует', {
        statusCode: 409,
        code: 'CONFLICT'
      });
    }
    
    return apiResponse.sendError(res, 'Ошибка создания тега', {
      statusCode: 500,
      code: 'DB_ERROR'
    });
  }
}));

/**
 * Массовое удаление тегов (должно быть ДО /:id)
 */
router.delete('/bulk', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { tagIds } = req.body;
  
  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    return apiResponse.sendError(res, 'Необходимо предоставить массив ID тегов', {
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
  }
  
  
  // Используем общую функцию удаления
  const result = await dbUtils.deleteTagsWithCleanup(tagIds);

  if (!result.success) {
    return apiResponse.sendError(res, 'Ошибка удаления тегов', {
      statusCode: 500,
      code: 'DB_ERROR',
      details: result.errors
    });
  }

  
  apiResponse.sendSuccess(res, {
    message: 'Массовое удаление завершено',
    total: tagIds.length,
    successCount: result.deletedCount,
    errorCount: result.errors?.length || 0,
    errors: result.errors
  });
}));

/**
 * Удаление одного тега
 */
router.delete('/:id', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const tagId = req.params.id;

  // Получаем информацию о теге перед удалением
  const { data: tag, error: tagError } = await supabase
    .from('tags')
    .select('name, usage_count')
    .eq('id', tagId)
    .single();

  if (tagError || !tag) {
    logger.warn('ADMIN', 'Тег не найден', { tagId });
    return apiResponse.sendError(res, 'Тег не найден', {
      statusCode: 404,
      code: 'NOT_FOUND'
    });
  }

  // Используем общую функцию удаления
  const result = await dbUtils.deleteTagsWithCleanup(tagId);

  if (!result.success) {
    return apiResponse.sendError(res, 'Ошибка удаления тега', {
      statusCode: 500,
      code: 'DB_ERROR'
    });
  }

  

  apiResponse.sendSuccess(res, {
    message: 'Тег успешно удален',
    tagName: tag.name,
    deletedConnections: result.deletedConnections || tag.usage_count || 0
  });
}));

/**
 * Исправление счетчиков использования тегов
 */
router.post('/fix-counters', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
    
  // Получаем все теги
  const { data: tags, error: tagsError } = await supabase
    .from('tags')
    .select('id, name, usage_count');
  
  if (tagsError) {
    return apiResponse.sendError(res, tagsError, {
      statusCode: 500,
      code: 'DB_ERROR',
      operation: 'получение тегов'
    });
  }

  if (!Array.isArray(tags) || tags.length === 0) {
    return apiResponse.sendSuccess(res, {
      message: 'Тегов не найдено',
      totalTags: 0,
      fixedCount: 0
    });
  }

  // Пересчитываем счетчики для каждого тега
  const tagIds = tags.map(t => t.id);
  const updateResult = await dbUtils.updateTagCounters(tagIds, true);

 
  
  apiResponse.sendSuccess(res, {
    message: `Исправлено ${updateResult.updatedCount} из ${tags.length} тегов`,
    totalTags: tags.length,
    fixedCount: updateResult.updatedCount,
    results: updateResult.results
  });
}));

module.exports = router;

