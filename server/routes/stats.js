/**
 * Роуты статистики и аналитики
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Получение статистики (оптимизированная версия)
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    logger.info('ADMIN', 'Запрос статистики');
    
    // Оптимизированный запрос - получаем все данные одним запросом
    const [usersResult, videosResult, tagsResult] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('videos').select('views_count, likes_count'),
      supabase.from('tags').select('*', { count: 'exact', head: true })
    ]);
    const usersCount = usersResult.count || 0;
    const videosCount = videosResult.data?.length || 0;
    const tagsCount = tagsResult.count || 0;

    // Вычисляем сумму просмотров и лайков
    const totalViews = videosResult.data?.reduce((sum, video) => sum + (video.views_count || 0), 0) || 0;
    const totalLikes = videosResult.data?.reduce((sum, video) => sum + (video.likes_count || 0), 0) || 0;

    const stats = {
      usersCount,
      videosCount,
      totalViews,
      totalLikes,
      tagsCount
    };

    
    res.json(stats);
  } catch (error) {
    logger.error('ADMIN', 'Ошибка получения статистики', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
  logger.success('ADMIN', 'Статистика получена');
});

/**
 * Расширенная аналитика с временными данными
 */
router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    logger.info('ADMIN', 'Запрос расширенной аналитики');

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Получаем данные за последние 7 и 30 дней параллельно
    const [
      usersLast7Days,
      videosLast7Days,
      usersLast30Days,
      videosLast30Days,
      topUsers,
      topVideos
    ] = await Promise.all([
      supabase.from('users').select('created_at', { count: 'exact' }).gte('created_at', sevenDaysAgo.toISOString()),
      supabase.from('videos').select('created_at', { count: 'exact' }).gte('created_at', sevenDaysAgo.toISOString()),
      supabase.from('users').select('created_at', { count: 'exact' }).gte('created_at', thirtyDaysAgo.toISOString()),
      supabase.from('videos').select('created_at', { count: 'exact' }).gte('created_at', thirtyDaysAgo.toISOString()),
      // Топ пользователей по количеству видео
      supabase.from('videos')
        .select('user_id, users(id, display_name, first_name, last_name)')
        .limit(100)
        .then(result => {
          if (!result.data) return [];
          const userCounts = {};
          result.data.forEach(video => {
            const userId = video.user_id;
            if (!userCounts[userId]) {
              userCounts[userId] = {
                user_id: userId,
                user_name: video.users?.display_name || video.users?.first_name || 'Неизвестно',
                videos_count: 0
              };
            }
            userCounts[userId].videos_count++;
          });
          return Object.values(userCounts).sort((a, b) => b.videos_count - a.videos_count).slice(0, 10);
        }),
      // Топ видео по просмотрам
      supabase.from('videos')
        .select('id, description, views_count, likes_count, users(display_name)')
        .order('views_count', { ascending: false })
        .limit(10)
    ]);

    // Создаем данные для графиков по дням (последние 7 дней)
    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      
      const dayUsersCount = usersLast7Days.data?.filter(u => {
        const createdAt = new Date(u.created_at);
        return createdAt >= date && createdAt < nextDate;
      }).length || 0;
      
      const dayVideosCount = videosLast7Days.data?.filter(v => {
        const createdAt = new Date(v.created_at);
        return createdAt >= date && createdAt < nextDate;
      }).length || 0;

      dailyStats.push({
        date: date.toISOString().split('T')[0],
        users: dayUsersCount,
        videos: dayVideosCount
      });
    }

    const analytics = {
      period: {
        last7Days: {
          users: usersLast7Days.count || 0,
          videos: videosLast7Days.count || 0
        },
        last30Days: {
          users: usersLast30Days.count || 0,
          videos: videosLast30Days.count || 0
        }
      },
      dailyStats,
      topUsers: topUsers || [],
      topVideos: topVideos.data || []
    };

    logger.success('ADMIN', 'Аналитика получена');
    res.json(analytics);
  } catch (error) {
    logger.error('ADMIN', 'Ошибка получения аналитики', error);
    res.status(500).json({ error: 'Ошибка получения аналитики' });
  }
});

/**
 * Получение логов активности (последние действия)
 */
router.get('/activity-logs', requireAdmin, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    logger.info('ADMIN', 'Запрос логов активности');

    // Получаем последние действия пользователей
    const [recentVideos, recentUsers] = await Promise.all([
      supabase.from('videos')
        .select(`
          id, description, created_at,
          users(id, display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit) / 2),
      supabase.from('users')
        .select('id, display_name, created_at')
        .order('created_at', { ascending: false })
        .limit(parseInt(limit) / 2)
    ]);

    // Объединяем и форматируем логи
    const logs = [];
    
    recentVideos.data?.forEach(video => {
      logs.push({
        type: 'video_upload',
        timestamp: video.created_at,
        user: video.users?.display_name || 'Неизвестно',
        description: `Загружено видео: ${video.description || 'Без описания'}`,
        data: { videoId: video.id }
      });
    });

    recentUsers.data?.forEach(user => {
      logs.push({
        type: 'user_registration',
        timestamp: user.created_at,
        user: user.display_name || 'Неизвестно',
        description: 'Регистрация нового пользователя',
        data: { userId: user.id }
      });
    });

    // Сортируем по времени
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ logs: logs.slice(0, parseInt(limit)) });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка получения логов активности', error);
    res.status(500).json({ error: 'Ошибка получения логов активности' });
  }
});

module.exports = router;

