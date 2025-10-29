/**
 * Функции для работы с видео в БД
 */

const supabase = require('../../config/supabase');
const logger = require('../logger');
const { getTagCountsByVideos } = require('./tags');

/**
 * Удалить видео и обновить счетчики тегов
 * @param {string|string[]} videoIds - ID или массив ID видео для удаления
 * @returns {Object} результат операции
 */
async function deleteVideosWithTagCleanup(videoIds) {
  const ids = Array.isArray(videoIds) ? videoIds : [videoIds];
  
  if (ids.length === 0) {
    return { success: true, deletedCount: 0, updatedTags: 0 };
  }

  try {
    // Получаем все теги, связанные с этими видео
    const tagCounts = await getTagCountsByVideos(ids);
    
    // Удаляем связи видео-теги
    const { error: tagsError } = await supabase
      .from('video_tags')
      .delete()
      .in('video_id', ids);

    if (tagsError) {
      logger.warn('DB', 'Ошибка удаления связей видео-теги', tagsError);
    }

    // Обновляем счетчики тегов
    const tagIds = Object.keys(tagCounts);
    let updatedTagCount = 0;

    if (tagIds.length > 0) {
      for (const tagId of tagIds) {
        const { data: tag, error: tagError } = await supabase
          .from('tags')
          .select('usage_count')
          .eq('id', tagId)
          .single();

        if (!tagError && tag) {
          const newCount = Math.max(0, (tag.usage_count || 0) - tagCounts[tagId]);
          const { error: updateError } = await supabase
            .from('tags')
            .update({ usage_count: newCount })
            .eq('id', tagId);

          if (!updateError) {
            updatedTagCount++;
          }
        }
      }
    }

    // Удаляем сами видео
    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .in('id', ids);

    if (deleteError) {
      logger.error('DB', 'Ошибка удаления видео', deleteError);
      throw deleteError;
    }

    logger.success('DB', 'Видео удалены и теги обновлены', {
      videoCount: ids.length,
      tagsUpdated: updatedTagCount
    });

    return {
      success: true,
      deletedCount: ids.length,
      updatedTags: updatedTagCount
    };
  } catch (error) {
    logger.error('DB', 'Ошибка в deleteVideosWithTagCleanup', error);
    throw error;
  }
}

/**
 * Получить все видео для админки
 * @returns {Promise<Object>} результат с видео и ошибкой
 */
async function getAllVideosForAdmin() {
  try {
    const { data: videos, error } = await supabase
      .from('videos')
      .select(`
        id, user_id, description, video_url,
        latitude, longitude, likes_count, views_count, comments_count,
        created_at,
        users (id, yandex_id, display_name, avatar_url)
      `)
      .order('created_at', { ascending: false });

    return { videos: videos || [], error };
  } catch (error) {
    logger.error('DB', 'Ошибка получения всех видео для админки', error);
    return { videos: [], error };
  }
}

/**
 * Поиск видео с фильтрацией для админки
 * @param {Object} filters - фильтры поиска
 * @returns {Promise<Object>} результат с видео, количеством и ошибкой
 */
async function searchVideosForAdmin(filters = {}) {
  try {
    const {
      query,
      userId,
      sortBy = 'created_at',
      order = 'desc',
      limit = 50,
      offset = 0,
      minViews,
      minLikes
    } = filters;

    let queryBuilder = supabase.from('videos').select(`
      id, user_id, description, video_url, latitude, longitude,
      likes_count, views_count, comments_count, created_at,
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

    return { videos: videos || [], count: count || 0, error };
  } catch (error) {
    logger.error('DB', 'Ошибка поиска видео для админки', error);
    return { videos: [], count: 0, error };
  }
}

module.exports = {
  deleteVideosWithTagCleanup,
  getAllVideosForAdmin,
  searchVideosForAdmin
};

