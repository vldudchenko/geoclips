/**
 * Общие утилиты для работы с БД
 * Функции, используемые в нескольких модулях
 */

const supabase = require('../../config/supabase');
const logger = require('../logger');

/**
 * Универсальная функция для подсчета записей по user_id
 * @param {string} table - Название таблицы
 * @param {string} userField - Название поля с user_id
 * @param {string[]} userIds - Массив ID пользователей
 * @param {Object} additionalFilters - Дополнительные фильтры
 * @returns {Object} Объект с количеством записей для каждого пользователя
 */
async function getCountsByUsers(table, userField, userIds, additionalFilters = {}) {
  if (!userIds || userIds.length === 0) return {};
  
  try {
    let query = supabase
      .from(table)
      .select(userField)
      .in(userField, userIds);
      
    // Применяем дополнительные фильтры
    Object.entries(additionalFilters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    const { data, error } = await query;
    
    if (error) {
      logger.error('DB', `Ошибка подсчета в ${table}`, error);
      return {};
    }
    
    return data?.reduce((acc, item) => {
      const userId = item[userField];
      acc[userId] = (acc[userId] || 0) + 1;
      return acc;
    }, {}) || {};
  } catch (error) {
    logger.error('DB', `Ошибка в getCountsByUsers для ${table}`, error);
    return {};
  }
}

/**
 * Получить связанные записи через видео пользователя
 * Паттерн: пользователь -> его видео -> записи к этим видео
 * @param {string} userId - ID пользователя
 * @param {string} itemTable - Таблица с записями
 * @param {string} selectFields - Поля для выборки
 * @returns {Object} Массив записей и ошибка
 */
async function getRelatedItemsByUserVideos(userId, itemTable, selectFields) {
  try {
    // 1. Получаем видео пользователя
    const { data: userVideos, error: videosError } = await supabase
      .from('videos')
      .select('id')
      .eq('user_id', userId);

    if (videosError || !userVideos || userVideos.length === 0) {
      return { items: [], error: videosError };
    }

    const videoIds = userVideos.map(v => v.id);

    // 2. Получаем связанные записи
    const { data: items, error } = await supabase
      .from(itemTable)
      .select(selectFields)
      .in('video_id', videoIds)
      .order('created_at', { ascending: false });

    return { items: items || [], error };
  } catch (error) {
    logger.error('DB', `Ошибка в getRelatedItemsByUserVideos для ${itemTable}`, error);
    return { items: [], error };
  }
}

/**
 * Подсчет связанных записей по пользователям через их видео
 * @param {string[]} userIds - Массив ID пользователей
 * @param {string} relatedTable - Таблица со связанными записями
 * @returns {Object} Объект с количеством записей для каждого пользователя
 */
async function countRelatedByUserVideos(userIds, relatedTable) {
  if (!userIds || userIds.length === 0) return {};
  
  try {
    // Получаем видео пользователей
    const { data: userVideos, error: videosError } = await supabase
      .from('videos')
      .select('id, user_id')
      .in('user_id', userIds);

    if (videosError || !userVideos || userVideos.length === 0) {
      return {};
    }

    const videoIds = userVideos.map(video => video.id);

    // Получаем связанные записи
    const { data: relatedItems, error: itemsError } = await supabase
      .from(relatedTable)
      .select('video_id')
      .in('video_id', videoIds);

    if (itemsError) {
      logger.error('DB', `Ошибка получения ${relatedTable}`, itemsError);
      return {};
    }

    // Создаем мапу video_id -> user_id
    const videoToUser = {};
    userVideos.forEach(video => {
      videoToUser[video.id] = video.user_id;
    });

    // Подсчитываем по пользователям
    return relatedItems?.reduce((acc, item) => {
      const userId = videoToUser[item.video_id];
      if (userId) {
        acc[userId] = (acc[userId] || 0) + 1;
      }
      return acc;
    }, {}) || {};
  } catch (error) {
    logger.error('DB', `Ошибка в countRelatedByUserVideos для ${relatedTable}`, error);
    return {};
  }
}

/**
 * Обработчик ошибок БД для стандартизированного ответа
 * @param {Object} error - объект ошибки Supabase
 * @param {string} operation - название операции
 * @param {string} defaultMessage - сообщение по умолчанию
 * @returns {Object} стандартизированный объект ошибки
 */
function handleDbError(error, operation = 'Database operation', defaultMessage = 'Database error') {
  logger.error('DB', `Ошибка ${operation}`, error);
  
  return {
    code: error.code || 'DB_ERROR',
    message: error.message || defaultMessage,
    details: error.details || null
  };
}

module.exports = {
  getCountsByUsers,
  getRelatedItemsByUserVideos,
  countRelatedByUserVideos,
  handleDbError
};

