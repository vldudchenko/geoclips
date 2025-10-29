/**
 * Функции для работы с просмотрами видео в БД
 */

const supabase = require('../../config/supabase');
const logger = require('../logger');

/**
 * Обновить счетчик просмотров видео
 * @param {string} videoId - ID видео
 * @returns {Promise<Object>} результат операции
 */
async function updateVideoViewsCount(videoId) {
  try {
    // Получаем текущий счетчик
    const { data: currentVideo, error: getCurrentError } = await supabase
      .from('videos')
      .select('views_count')
      .eq('id', videoId)
      .single();

    if (getCurrentError) {
      logger.error('DB', 'Ошибка получения текущего счетчика просмотров', getCurrentError);
      return { success: false, error: getCurrentError };
    }

    // Увеличиваем счетчик на 1
    const { error: updateError } = await supabase
      .from('videos')
      .update({ views_count: (currentVideo.views_count || 0) + 1 })
      .eq('id', videoId);

    if (updateError) {
      logger.error('DB', 'Ошибка обновления счетчика просмотров', updateError);
      return { success: false, error: updateError };
    }

    logger.info('DB', 'Счетчик просмотров обновлен', { videoId, newCount: (currentVideo.views_count || 0) + 1 });
    return { success: true, newCount: (currentVideo.views_count || 0) + 1 };
  } catch (error) {
    logger.error('DB', 'Ошибка в updateVideoViewsCount', error);
    return { success: false, error };
  }
}

/**
 * Исправить счетчики просмотров для всех видео
 * Пересчитывает views_count на основе реальных записей в video_views
 * @returns {Promise<Object>} результат операции
 */
async function fixVideoViewsCounters() {
  try {
    logger.info('DB', 'Начинаем исправление счетчиков просмотров');
    
    // Получаем все видео
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('id, views_count');
    
    if (videosError) {
      logger.error('DB', 'Ошибка получения списка видео', videosError);
      return { success: false, error: videosError };
    }
    
    let fixedCount = 0;
    const results = [];
    
    for (const video of videos) {
      // Получаем реальное количество просмотров из таблицы video_views
      const { count: realViewsCount, error: countError } = await supabase
        .from('video_views')
        .select('*', { count: 'exact', head: true })
        .eq('video_id', video.id);
      
      if (countError) {
        logger.error('DB', 'Ошибка подсчета просмотров для видео', { videoId: video.id, error: countError });
        continue;
      }
      
      const realCount = realViewsCount || 0;
      const currentCount = video.views_count || 0;
      
      // Если счетчики не совпадают, обновляем
      if (realCount !== currentCount) {
        const { error: updateError } = await supabase
          .from('videos')
          .update({ views_count: realCount })
          .eq('id', video.id);
        
        if (updateError) {
          logger.error('DB', 'Ошибка обновления счетчика просмотров', { videoId: video.id, error: updateError });
          continue;
        }
        
        fixedCount++;
        results.push({
          videoId: video.id,
          oldCount: currentCount,
          newCount: realCount
        });
        
        logger.info('DB', 'Счетчик просмотров исправлен', { 
          videoId: video.id, 
          oldCount: currentCount, 
          newCount: realCount 
        });
      }
    }
    
    logger.info('DB', 'Исправление счетчиков просмотров завершено', { 
      totalVideos: videos.length, 
      fixedCount, 
      results: results.slice(0, 5) // Показываем только первые 5 результатов
    });
    
    return { success: true, fixedCount, totalVideos: videos.length, results };
  } catch (error) {
    logger.error('DB', 'Ошибка в fixVideoViewsCounters', error);
    return { success: false, error };
  }
}

/**
 * Получить просмотры видео для админки
 * @param {string} videoId - ID видео
 * @returns {Promise<Object>} результат с информацией о просмотрах и ошибкой
 */
async function getVideoViewsForAdmin(videoId) {
  try {
    // Получаем список пользователей, которые просмотрели видео
    const { data: views, error } = await supabase
      .from('video_views')
      .select(`
        id,
        created_at,
        users (
          id,
          display_name,
          avatar_url,
          yandex_id
        )
      `)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    if (error) {
      return { views: [], error };
    }

    // Получаем общее количество просмотров
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('views_count, description')
      .eq('id', videoId)
      .single();

    if (videoError) {
      return { views: [], error: videoError };
    }

    // Формируем результат
    const result = {
      total_views: video.views_count || 0,
      video_description: video.description || 'Без описания',
      viewers: views?.map(view => ({
        id: view.id,
        viewed_at: view.created_at,
        user: view.users ? {
          id: view.users.id,
          display_name: view.users.display_name || 'Неизвестно',
          avatar_url: view.users.avatar_url,
          yandex_id: view.users.yandex_id
        } : null
      })).filter(view => view.user) || []
    };

    return { views: [result], error: null };
  } catch (error) {
    logger.error('DB', 'Ошибка получения просмотров видео для админки', error);
    return { views: [], error };
  }
}

module.exports = {
  updateVideoViewsCount,
  fixVideoViewsCounters,
  getVideoViewsForAdmin
};

