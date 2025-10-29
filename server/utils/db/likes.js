/**
 * Функции для работы с лайками в БД
 */

const supabase = require('../../config/supabase');
const logger = require('../logger');
const { getCountsByUsers, getRelatedItemsByUserVideos, countRelatedByUserVideos } = require('./shared');

/**
 * Получить количество лайков поставленных пользователями
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством поставленных лайков для каждого пользователя
 */
async function getLikesGivenByUsers(userIds) {
  if (!userIds || userIds.length === 0) return {};
  
  try {
    logger.info('DB', 'Получаем лайки пользователей', { userIds: userIds.slice(0, 3) });
    
    const result = await getCountsByUsers('likes', 'user_id', userIds);
    
    logger.info('DB', 'Найдено лайков', { count: Object.keys(result).length });
    logger.info('DB', 'Результат лайков по пользователям', result);
    
    return result;
  } catch (error) {
    logger.error('DB', 'Ошибка в getLikesGivenByUsers', error);
    return {};
  }
}

/**
 * Получить количество лайков полученных пользователями (лайки их видео)
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством полученных лайков для каждого пользователя
 */
async function getLikesReceivedByUsers(userIds) {
  if (!userIds || userIds.length === 0) return {};

  try {
    const { data: videoLikes, error } = await supabase
      .from('videos')
      .select('user_id, likes_count')
      .in('user_id', userIds);

    if (error) {
      logger.error('DB', 'Ошибка получения полученных лайков', error);
      return {};
    }

    return videoLikes?.reduce((acc, video) => {
      const userId = video.user_id;
      acc[userId] = (acc[userId] || 0) + (video.likes_count || 0);
      return acc;
    }, {}) || {};
  } catch (error) {
    logger.error('DB', 'Ошибка в getLikesReceivedByUsers', error);
    return {};
  }
}

/**
 * Получить лайки поставленные пользователем
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} результат с лайками и ошибкой
 */
async function getLikesGivenByUser(userId) {
  try {
    const { data: likes, error } = await supabase
      .from('likes')
      .select(`
        id,
        created_at,
        video_id,
        videos!inner(
          id,
          description,
          user_id
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return { likes: [], error };
    }

    const processedLikes = likes?.map(like => ({
      id: like.id,
      created_at: like.created_at,
      video_id: like.video_id,
      video_description: like.videos?.description || 'Без описания'
    })) || [];

    return { likes: processedLikes, error: null };
  } catch (error) {
    logger.error('DB', 'Ошибка получения поставленных лайков пользователя', error);
    return { likes: [], error };
  }
}

/**
 * Получить лайки полученные пользователем (лайки его видео)
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} результат с лайками и ошибкой
 */
async function getLikesReceivedByUser(userId) {
  const { items: likes, error } = await getRelatedItemsByUserVideos(
    userId,
    'likes',
    `id, created_at, video_id, user_id, videos!inner(id, description), users(id, display_name, avatar_url)`
  );

  if (error) {
    return { likes: [], error };
  }

  const processedLikes = likes.map(like => ({
    id: like.id,
    created_at: like.created_at,
    video_id: like.video_id,
    video_description: like.videos?.description || 'Без описания',
    user_id: like.user_id,
    user_name: like.users?.display_name || 'Неизвестный пользователь',
    user_avatar: like.users?.avatar_url || null
  }));

  return { likes: processedLikes, error: null };
}

/**
 * Получить лайки видео для админки
 * @param {string} videoId - ID видео
 * @returns {Promise<Object>} результат с лайками и ошибкой
 */
async function getVideoLikesForAdmin(videoId) {
  try {
    const { data: likes, error } = await supabase
      .from('likes')
      .select(`
        id,
        created_at,
        users (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    return { likes: likes || [], error };
  } catch (error) {
    logger.error('DB', 'Ошибка получения лайков видео для админки', error);
    return { likes: [], error };
  }
}

module.exports = {
  getLikesGivenByUsers,
  getLikesReceivedByUsers,
  getLikesGivenByUser,
  getLikesReceivedByUser,
  getVideoLikesForAdmin
};

