/**
 * Функции для работы с комментариями в БД
 */

const supabase = require('../../config/supabase');
const logger = require('../logger');
const { getCountsByUsers, getRelatedItemsByUserVideos, countRelatedByUserVideos } = require('./shared');

/**
 * Получить количество комментариев написанных пользователями
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством написанных комментариев для каждого пользователя
 */
async function getCommentsWrittenByUsers(userIds) {
  if (!userIds || userIds.length === 0) return {};
  
  try {
    logger.info('DB', 'Получаем комментарии пользователей', { userIds: userIds.slice(0, 3) });
    
    const result = await getCountsByUsers('comments', 'user_id', userIds);
    
    logger.info('DB', 'Найдено комментариев', { count: Object.keys(result).length });
    logger.info('DB', 'Результат комментариев по пользователям', result);
    
    return result;
  } catch (error) {
    logger.error('DB', 'Ошибка в getCommentsWrittenByUsers', error);
    return {};
  }
}

/**
 * Получить количество комментариев полученных пользователями (комментарии к их видео)
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством полученных комментариев для каждого пользователя
 */
async function getCommentsReceivedByUsers(userIds) {
  return countRelatedByUserVideos(userIds, 'comments');
}

/**
 * Получить комментарии для видео
 * @param {string} videoId - ID видео
 * @param {Object} options - опции запроса
 * @returns {Promise<Object>} результат с комментариями и ошибкой
 */
async function getCommentsForVideo(videoId, options = {}) {
  try {
    const { limit = 50, offset = 0, sortBy = 'created_at', order = 'desc' } = options;

    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        id,
        text,
        created_at,
        updated_at,
        users (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('video_id', videoId)
      .order(sortBy, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      return { comments: [], total: 0, error };
    }

    // Получаем актуальный счетчик комментариев
    const { data: videoData, error: videoCountError } = await supabase
      .from('videos')
      .select('comments_count')
      .eq('id', videoId)
      .single();

    if (videoCountError) {
      logger.warn('DB', 'Ошибка получения счетчика комментариев', videoCountError);
    }

    return { 
      comments: comments || [], 
      total: videoData?.comments_count || 0,
      error: null 
    };
  } catch (error) {
    logger.error('DB', 'Ошибка получения комментариев для видео', error);
    return { comments: [], total: 0, error };
  }
}

/**
 * Создать комментарий к видео
 * @param {string} videoId - ID видео
 * @param {string} userId - ID пользователя
 * @param {string} text - текст комментария
 * @returns {Promise<Object>} результат операции
 */
async function createCommentForVideo(videoId, userId, text) {
  try {
    // Проверяем, что видео существует
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return { success: false, error: 'Видео не найдено' };
    }

    // Создаем комментарий
    const { data: insertedComment, error: insertError } = await supabase
      .from('comments')
      .insert([{
        video_id: videoId,
        user_id: userId,
        text: text.trim()
      }])
      .select('id')
      .single();

    if (insertError) {
      logger.error('DB', 'Ошибка создания комментария', insertError);
      return { success: false, error: insertError };
    }

    // Получаем полные данные комментария с пользователем
    const { data: comment, error: selectError } = await supabase
      .from('comments')
      .select(`
        id,
        text,
        created_at,
        updated_at,
        users (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('id', insertedComment.id)
      .single();

    if (selectError) {
      logger.error('DB', 'Ошибка получения данных комментария', selectError);
      return { success: false, error: selectError };
    }

    return { success: true, comment };
  } catch (error) {
    logger.error('DB', 'Ошибка создания комментария', error);
    return { success: false, error };
  }
}

/**
 * Получить все комментарии для админки
 * @param {Object} filters - фильтры
 * @returns {Promise<Object>} результат с комментариями и ошибкой
 */
async function getAllCommentsForAdmin(filters = {}) {
  try {
    const { limit = 100, offset = 0, sortBy = 'created_at', order = 'desc', videoId } = filters;

    let query = supabase
      .from('comments')
      .select(`
        id,
        text,
        created_at,
        updated_at,
        users (
          id,
          display_name,
          avatar_url
        ),
        videos (
          id,
          description,
          user_id
        )
      `, { count: 'exact' })
      .order(sortBy, { ascending: order === 'asc' });

    // Фильтрация по видео (если указано)
    if (videoId) {
      query = query.eq('video_id', videoId);
    }

    const { data: comments, error, count } = await query
      .range(offset, offset + limit - 1);

    return { comments: comments || [], total: count || 0, error };
  } catch (error) {
    logger.error('DB', 'Ошибка получения всех комментариев для админки', error);
    return { comments: [], total: 0, error };
  }
}

/**
 * Получить комментарии пользователя (написанные)
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} результат с комментариями и ошибкой
 */
async function getCommentsWrittenByUser(userId) {
  try {
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        id,
        text,
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
      return { comments: [], error };
    }

    const processedComments = comments?.map(comment => ({
      id: comment.id,
      text: comment.text,
      created_at: comment.created_at,
      video_id: comment.video_id,
      video_description: comment.videos?.description || 'Без описания'
    })) || [];

    return { comments: processedComments, error: null };
  } catch (error) {
    logger.error('DB', 'Ошибка получения написанных комментариев пользователя', error);
    return { comments: [], error };
  }
}

/**
 * Получить комментарии полученные пользователем (к его видео)
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} результат с комментариями и ошибкой
 */
async function getCommentsReceivedByUser(userId) {
  const { items: comments, error } = await getRelatedItemsByUserVideos(
    userId,
    'comments',
    `id, text, created_at, video_id, videos!inner(id, description)`
  );

  if (error) {
    return { comments: [], error };
  }

  const processedComments = comments.map(comment => ({
    id: comment.id,
    text: comment.text,
    created_at: comment.created_at,
    video_id: comment.video_id,
    video_description: comment.videos?.description || 'Без описания'
  }));

  return { comments: processedComments, error: null };
}

/**
 * Удалить комментарии видео
 * @param {string} videoId - ID видео
 * @returns {Object} результат операции
 */
async function deleteVideoComments(videoId) {
  if (!videoId) {
    return { success: false, deleted: 0 };
  }

  try {
    const { count, error } = await supabase
      .from('comments')
      .delete({ count: 'exact' })
      .eq('video_id', videoId);

    if (error) {
      logger.error('DB', 'Ошибка удаления комментариев видео', { videoId, error });
      throw error;
    }

    logger.success('DB', 'Комментарии видео удалены', { videoId, deleted: count });

    return {
      success: true,
      deleted: count || 0
    };
  } catch (error) {
    logger.error('DB', 'Ошибка в deleteVideoComments', { videoId, error: error.message });
    throw error;
  }
}

/**
 * Удалить комментарии пользователя
 * @param {string} userId - ID пользователя
 * @returns {Object} результат операции
 */
async function deleteUserComments(userId) {
  if (!userId) {
    return { success: false, deleted: 0 };
  }

  try {
    const { count, error } = await supabase
      .from('comments')
      .delete({ count: 'exact' })
      .eq('user_id', userId);

    if (error) {
      logger.error('DB', 'Ошибка удаления комментариев пользователя', { userId, error });
      throw error;
    }

    logger.success('DB', 'Комментарии пользователя удалены', { userId, deleted: count });

    return {
      success: true,
      deleted: count || 0
    };
  } catch (error) {
    logger.error('DB', 'Ошибка в deleteUserComments', { userId, error: error.message });
    throw error;
  }
}

/**
 * Получить комментарии видео для админки
 * @param {string} videoId - ID видео
 * @returns {Promise<Object>} результат с комментариями и ошибкой
 */
async function getVideoCommentsForAdmin(videoId) {
  try {
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        id,
        text,
        created_at,
        users (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    return { comments: comments || [], error };
  } catch (error) {
    logger.error('DB', 'Ошибка получения комментариев видео для админки', error);
    return { comments: [], error };
  }
}

module.exports = {
  getCommentsWrittenByUsers,
  getCommentsReceivedByUsers,
  getCommentsForVideo,
  createCommentForVideo,
  getAllCommentsForAdmin,
  getCommentsWrittenByUser,
  getCommentsReceivedByUser,
  deleteVideoComments,
  deleteUserComments,
  getVideoCommentsForAdmin
};

