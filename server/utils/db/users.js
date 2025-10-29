/**
 * Функции для работы с пользователями в БД
 */

const supabase = require('../../config/supabase');
const logger = require('../logger');
const { getCountsByUsers } = require('./shared');

/**
 * Получить счетчик видео для пользователей
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством видео для каждого пользователя
 */
async function getVideoCountsByUsers(userIds) {
  return getCountsByUsers('videos', 'user_id', userIds);
}

/**
 * Получить количество созданных тегов для пользователей
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством созданных тегов для каждого пользователя
 */
async function getTagsCountsByUsers(userIds) {
  if (!userIds || userIds.length === 0) return {};
  
  try {
    logger.info('DB', 'Получаем теги пользователей', { userIds: userIds.slice(0, 3) });
    
    const { data: userTags, error } = await supabase
      .from('tags')
      .select('user_id')
      .in('user_id', userIds);

    if (error) {
      logger.error('DB', 'Ошибка получения созданных тегов пользователей', error);
      return {};
    }

    logger.info('DB', 'Найдено тегов', { count: userTags?.length || 0 });

    const result = userTags?.reduce((acc, tag) => {
      const userId = tag.user_id;
      if (userId) {
        acc[userId] = (acc[userId] || 0) + 1;
      }
      return acc;
    }, {}) || {};

    logger.info('DB', 'Результат тегов по пользователям', result);
    return result;
  } catch (error) {
    logger.error('DB', 'Ошибка в getTagsCountsByUsers', error);
    return {};
  }
}

/**
 * Получить количество использованных тегов для пользователей (теги в их видео)
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством использованных тегов для каждого пользователя
 */
async function getTagsUsedByUsers(userIds) {
  if (!userIds || userIds.length === 0) return {};

  try {
    // Получаем видео пользователей
    const { data: userVideos, error: videosError } = await supabase
      .from('videos')
      .select('id, user_id')
      .in('user_id', userIds);

    if (videosError) {
      logger.error('DB', 'Ошибка получения видео пользователей', videosError);
      return {};
    }

    if (!userVideos || userVideos.length === 0) {
      return {};
    }

    const videoIds = userVideos.map(video => video.id);

    // Получаем теги для этих видео
    const { data: videoTags, error: tagsError } = await supabase
      .from('video_tags')
      .select('video_id')
      .in('video_id', videoIds);

    if (tagsError) {
      logger.error('DB', 'Ошибка получения тегов видео', tagsError);
      return {};
    }

    // Создаем мапу video_id -> user_id
    const videoToUser = {};
    userVideos.forEach(video => {
      videoToUser[video.id] = video.user_id;
    });

    // Подсчитываем теги по пользователям
    return videoTags?.reduce((acc, videoTag) => {
      const userId = videoToUser[videoTag.video_id];
      if (userId) {
        acc[userId] = (acc[userId] || 0) + 1;
      }
      return acc;
    }, {}) || {};
  } catch (error) {
    logger.error('DB', 'Ошибка в getTagsUsedByUsers', error);
    return {};
  }
}

module.exports = {
  getVideoCountsByUsers,
  getTagsCountsByUsers,
  getTagsUsedByUsers
};

