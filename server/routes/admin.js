/**
 * Админские роуты
 */

const express = require('express');
const router = express.Router();
const ffmpeg = require('fluent-ffmpeg');
const { requireAdmin } = require('../middleware/auth');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { readFile, access } = require('fs').promises;
const path = require('path');

/**
 * Главная страница админки
 */
router.get('/', async (req, res) => {
  try {
    // Получаем список админов из конфигурации
    const config = require('../config/environment');
    const adminIds = config.admin.ids;
    
    logger.info('ADMIN', 'Запрос к админке', {
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      hasUser: !!req.user,
      userId: req.user?.dbUser?.id,
      url: req.url,
      method: req.method,
      adminIds: adminIds,
      adminIdsLength: adminIds.length,
      sessionId: req.sessionID,
      userAgent: req.get('User-Agent')
    });
    
    // Если пользователь не авторизован, показываем страницу входа
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      logger.warn('ADMIN', 'Пользователь не авторизован, показываем страницу входа', {
        isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
        hasUser: !!req.user,
        sessionId: req.sessionID,
        cookies: req.headers.cookie
      });
      const loginHtml = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>GeoClips Admin - Вход</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: gradientShift 15s ease infinite;
                    background-size: 200% 200%;
                }
                @keyframes gradientShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .login-container {
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(20px);
                    border-radius: 24px;
                    padding: 40px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
                    text-align: center;
                    max-width: 400px;
                    width: 90%;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
                .login-container h1 {
                    color: #333;
                    margin-bottom: 20px;
                    font-size: 2rem;
                }
                .login-container p {
                    color: #666;
                    margin-bottom: 30px;
                    line-height: 1.5;
                }
                .login-btn {
                    background: linear-gradient(135deg, #ffcc00 0%, #e6b800 100%);
                    color: #000;
                    border: none;
                    padding: 16px 32px;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-decoration: none;
                    display: inline-block;
                    box-shadow: 0 4px 15px rgba(255, 204, 0, 0.3);
                }
                .login-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(255, 204, 0, 0.4);
                }
                .warning {
                    background: #fff3cd;
                    color: #856404;
                    padding: 15px;
                    border-radius: 8px;
                    margin-top: 20px;
                    border-left: 4px solid #ffc107;
                }
            </style>
        </head>
        <body>
            <div class="login-container">
                <h1>🎥 GeoClips Admin</h1>
                <p>Для доступа к панели администратора необходимо авторизоваться через Яндекс</p>
                <a href="/auth/yandex?returnTo=/admin" class="login-btn">🔐 Войти через Яндекс</a>
                
            </div>
        </body>
        </html>
      `;
      return res.send(loginHtml);
    }

    // Проверяем права администратора
    const userId = req.user?.dbUser?.id;
    
    logger.info('ADMIN', 'Проверка доступа к админке', {
      userId: userId,
      adminIds: adminIds,
      isAuthenticated: req.isAuthenticated(),
      hasUser: !!req.user
    });
    
    // Если ADMIN_IDS не задана, разрешаем доступ всем авторизованным пользователям
    if (adminIds.length > 0 && !adminIds.includes(userId)) {
      const accessDeniedHtml = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>GeoClips Admin - Доступ запрещен</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .error-container {
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(20px);
                    border-radius: 24px;
                    padding: 40px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
                    text-align: center;
                    max-width: 400px;
                    width: 90%;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
                .error-container h1 {
                    color: #dc3545;
                    margin-bottom: 20px;
                    font-size: 2rem;
                }
                .error-container p {
                    color: #666;
                    margin-bottom: 30px;
                    line-height: 1.5;
                }
                .back-btn {
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 14px;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                }
                .back-btn:hover {
                    background: #5a6268;
                }
            </style>
        </head>
        <body>
            <div class="error-container">
                <h1>🚫 Доступ запрещен</h1>
                <p>У вас нет прав для доступа к панели администратора.</p>
                <p><strong>Ваш ID:</strong> ${userId}</p>
                <p>Обратитесь к администратору для получения доступа.</p>
                <a href="/auth/logout" class="back-btn">Выйти</a>
            </div>
        </body>
        </html>
      `;
      return res.send(accessDeniedHtml);
    }

    // Если все проверки пройдены, показываем админку
    try {
      const htmlPath = path.join(__dirname, '../views/admin.html');
      logger.info('ADMIN', 'Загрузка админки', { htmlPath });
      
      // Проверяем существование файла
      try {
        await access(htmlPath);
      } catch (accessError) {
        logger.error('ADMIN', 'Файл админки не найден', { htmlPath, error: accessError.message });
        throw new Error(`Файл админки не найден: ${htmlPath}`);
      }
      
      const html = await readFile(htmlPath, 'utf-8');
      res.send(html);
    } catch (fileError) {
      logger.error('ADMIN', 'Ошибка чтения файла админки', fileError);      
    }
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки админ панели', { 
      message: error.message, 
      stack: error.stack,
      userId: req.user?.dbUser?.id,
      isAuthenticated: req.isAuthenticated()
    });
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Ошибка админки</h1>
          <p>Произошла ошибка при загрузке админ панели.</p>
          <p>Ошибка: ${error.message}</p>
          <a href="/admin">Попробовать снова</a>
        </body>
      </html>
    `);
  }
});

/**
 * Выход из админки
 */
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      logger.error('ADMIN', 'Ошибка при выходе из админки', err);
      return res.status(500).json({ error: 'Ошибка при выходе' });
    }
    logger.success('ADMIN', 'Пользователь вышел из админки');
    res.json({ success: true, redirect: '/admin' });
  });
});

/**
 * CSS файл админки
 */
router.get('/admin.css', async (req, res) => {
  try {
    const cssPath = path.join(__dirname, '../views/admin.css');
    const css = await readFile(cssPath, 'utf-8');
    res.type('text/css').send(css);
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки CSS', error);
    res.status(500).send('/* Ошибка загрузки CSS */');
  }
});

/**
 * JS файл админки
 */
router.get('/admin.js', async (req, res) => {
  try {
    const jsPath = path.join(__dirname, '../views/admin.js');
    const js = await readFile(jsPath, 'utf-8');
    res.type('application/javascript').send(js);
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки JS', error);
    res.status(500).send('// Ошибка загрузки JS');
  }
});

/**
 * Тестовый маршрут для проверки API
 */
router.get('/test', async (req, res) => {
  try {
    logger.info('ADMIN', 'Тестовый запрос');
    res.json({ message: 'API работает!', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка тестового запроса', error);
    res.status(500).json({ error: 'Ошибка тестового запроса' });
  }
});

/**
 * Получение статистики
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    logger.info('ADMIN', 'Запрос статистики');
    
    // Получаем количество пользователей
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Получаем количество видео
    const { count: videosCount } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true });

    // Получаем общее количество просмотров
    const { data: videosData } = await supabase
      .from('videos')
      .select('views_count');

    const totalViews = videosData?.reduce((sum, video) => sum + (video.views_count || 0), 0) || 0;

    // Получаем общее количество лайков
    const { data: likesData } = await supabase
      .from('videos')
      .select('likes_count');

    const totalLikes = likesData?.reduce((sum, video) => sum + (video.likes_count || 0), 0) || 0;

    const stats = {
      usersCount: usersCount || 0,
      videosCount: videosCount || 0,
      totalViews,
      totalLikes
    };

    logger.info('ADMIN', 'Статистика получена', stats);
    res.json(stats);
  } catch (error) {
    logger.error('ADMIN', 'Ошибка получения статистики', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

/**
 * Получение списка пользователей
 */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    logger.info('ADMIN', 'Запрос списка пользователей');
    
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        yandex_id,
        first_name,
        last_name,
        display_name,
        avatar_url,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('ADMIN', 'Ошибка получения пользователей', error);
      return res.status(500).json({ error: 'Ошибка получения пользователей' });
    }

    // Получаем количество видео для каждого пользователя
    const userIds = users?.map(user => user.id) || [];
    let videosCounts = {};
    
    if (userIds.length > 0) {
      const { data: videoCounts, error: countError } = await supabase
        .from('videos')
        .select('user_id')
        .in('user_id', userIds);
      
      if (!countError && videoCounts) {
        // Подсчитываем количество видео для каждого пользователя
        videosCounts = videoCounts.reduce((acc, video) => {
          acc[video.user_id] = (acc[video.user_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    // Обрабатываем данные для отображения
    const processedUsers = users?.map(user => ({
      ...user,
      videos_count: videosCounts[user.id] || 0
    })) || [];

    logger.info('ADMIN', 'Получены пользователи', { count: processedUsers.length });
    res.json(processedUsers);
  } catch (error) {
    logger.error('ADMIN', 'Ошибка получения пользователей', error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

/**
 * Получение списка видео
 */
router.get('/videos', requireAdmin, async (req, res) => {
  try {
    logger.info('ADMIN', 'Запрос списка видео');
    
     const { data: videos, error } = await supabase
       .from('videos')
       .select(`
         id,
         user_id,
         description,
         video_url,
         latitude,
         longitude,
         likes_count,
         views_count,
         created_at,
         updated_at,
         users (
           id,
           yandex_id,
           display_name,
           avatar_url
         )
       `)
       .order('created_at', { ascending: false });

    if (error) {
      logger.error('ADMIN', 'Ошибка получения видео', error);
      return res.status(500).json({ error: 'Ошибка получения видео' });
    }

    logger.info('ADMIN', 'Получены видео', { count: videos?.length || 0 });
    res.json(videos || []);
  } catch (error) {
    logger.error('ADMIN', 'Ошибка получения видео', error);
    res.status(500).json({ error: 'Ошибка получения видео' });
  }
});

/**
 * Удаление видео
 */
router.delete('/videos/:id', requireAdmin, async (req, res) => {
  try {
    const videoId = req.params.id;
    
     // Сначала получаем информацию о видео для удаления файлов
     const { data: video, error: fetchError } = await supabase
       .from('videos')
       .select('video_url')
       .eq('id', videoId)
       .single();

    if (fetchError) {
      logger.error('ADMIN', 'Ошибка получения видео для удаления', fetchError);
      return res.status(404).json({ error: 'Видео не найдено' });
    }

    // Удаляем связанные теги
    const { error: tagsError } = await supabase
      .from('video_tags')
      .delete()
      .eq('video_id', videoId);

    if (tagsError) {
      logger.warn('ADMIN', 'Ошибка удаления тегов видео', tagsError);
    }

    // Удаляем видео из базы данных
    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId);

    if (deleteError) {
      logger.error('ADMIN', 'Ошибка удаления видео', deleteError);
      return res.status(500).json({ error: 'Ошибка удаления видео' });
    }

    // TODO: Здесь можно добавить удаление файлов из Supabase Storage
    // если нужно удалять физические файлы

    logger.info('ADMIN', 'Видео удалено', { videoId });
    res.json({ message: 'Видео успешно удалено' });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка удаления видео', error);
    res.status(500).json({ error: 'Ошибка удаления видео' });
  }
});

/**
 * Получение списка тегов
 */
router.get('/tags', requireAdmin, async (req, res) => {
  try {
    logger.info('ADMIN', 'Запрос списка тегов');
    
    const { data: tags, error } = await supabase
      .from('tags')
      .select(`
        id,
        name,
        usage_count,
        created_at
      `)
      .order('name', { ascending: true });

    if (error) {
      logger.error('ADMIN', 'Ошибка получения тегов', error);
      return res.status(500).json({ error: 'Ошибка получения тегов' });
    }

    logger.info('ADMIN', 'Получены теги', { count: tags?.length || 0 });
    res.json(tags || []);
  } catch (error) {
    logger.error('ADMIN', 'Ошибка получения тегов', error);
    res.status(500).json({ error: 'Ошибка получения тегов' });
  }
});

/**
 * Удаление тега
 */
router.delete('/tags/:id', requireAdmin, async (req, res) => {
  try {
    const tagId = req.params.id;
    
    logger.info('ADMIN', 'Удаление тега', { tagId });

    // Получаем информацию о теге перед удалением
    const { data: tag, error: tagError } = await supabase
      .from('tags')
      .select('name, usage_count')
      .eq('id', tagId)
      .single();

    if (tagError || !tag) {
      logger.warn('ADMIN', 'Тег не найден', { tagId });
      return res.status(404).json({ error: 'Тег не найден' });
    }

    const usageCount = tag.usage_count || 0;
    
    // Сначала удаляем все связи тега с видео
    const { error: videoTagsError } = await supabase
      .from('video_tags')
      .delete()
      .eq('tag_id', tagId);

    if (videoTagsError) {
      logger.error('ADMIN', 'Ошибка удаления связей тега с видео', videoTagsError);
      return res.status(500).json({ error: 'Ошибка удаления связей тега' });
    }

    // Обновляем счетчик использования тега на 0 перед удалением
    const { error: updateError } = await supabase
      .from('tags')
      .update({ usage_count: 0 })
      .eq('id', tagId);

    if (updateError) {
      logger.error('ADMIN', 'Ошибка обновления счетчика тега', updateError);
      // Продолжаем удаление даже если не удалось обновить счетчик
    }

    // Удаляем тег из базы данных
    const { error: deleteError } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId);

    if (deleteError) {
      logger.error('ADMIN', 'Ошибка удаления тега', deleteError);
      return res.status(500).json({ error: 'Ошибка удаления тега' });
    }

    logger.success('ADMIN', 'Тег успешно удален', { 
      tagId, 
      tagName: tag.name, 
      usageCount: usageCount 
    });
    res.json({ 
      message: 'Тег успешно удален',
      tagName: tag.name,
      deletedConnections: usageCount
    });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка удаления тега', error);
    res.status(500).json({ error: 'Ошибка удаления тега' });
  }
});

/**
 * Исправление счетчиков использования тегов
 */
router.post('/tags/fix-counters', requireAdmin, async (req, res) => {
  try {
    logger.info('ADMIN', 'Исправление счетчиков использования тегов');
    
    // Получаем все теги с их текущими счетчиками
    const { data: tags, error: tagsError } = await supabase
      .from('tags')
      .select('id, name, usage_count');
    
    if (tagsError) {
      logger.error('ADMIN', 'Ошибка получения тегов', tagsError);
      return res.status(500).json({ error: 'Ошибка получения тегов' });
    }
    
    let fixedCount = 0;
    const results = [];
    
    // Исправляем счетчики для каждого тега
    for (const tag of tags) {
      // Получаем реальное количество связей
      const { count: realCount, error: countError } = await supabase
        .from('video_tags')
        .select('*', { count: 'exact', head: true })
        .eq('tag_id', tag.id);
      
      if (countError) {
        logger.error('ADMIN', 'Ошибка подсчета связей для тега', { tagId: tag.id, error: countError });
        continue;
      }
      
      const actualCount = realCount || 0;
      const currentCount = tag.usage_count || 0;
      
      // Если счетчики не совпадают, обновляем
      if (actualCount !== currentCount) {
        const { error: updateError } = await supabase
          .from('tags')
          .update({ usage_count: actualCount })
          .eq('id', tag.id);
        
        if (updateError) {
          logger.error('ADMIN', 'Ошибка обновления счетчика тега', { tagId: tag.id, error: updateError });
          continue;
        }
        
        fixedCount++;
        results.push({
          tagId: tag.id,
          tagName: tag.name,
          oldCount: currentCount,
          newCount: actualCount
        });
        
        logger.info('ADMIN', 'Счетчик тега исправлен', { 
          tagId: tag.id, 
          tagName: tag.name, 
          oldCount: currentCount, 
          newCount: actualCount 
        });
      }
    }
    
    logger.success('ADMIN', 'Исправление счетчиков завершено', { 
      totalTags: tags.length, 
      fixedCount: fixedCount 
    });
    
    res.json({
      success: true,
      message: `Исправлено ${fixedCount} из ${tags.length} тегов`,
      totalTags: tags.length,
      fixedCount: fixedCount,
      results: results
    });
    
  } catch (error) {
    logger.error('ADMIN', 'Ошибка исправления счетчиков тегов', error);
    res.status(500).json({ error: 'Ошибка исправления счетчиков тегов' });
  }
});

/**
 * Массовое удаление тегов
 */
router.delete('/tags/bulk', requireAdmin, async (req, res) => {
  try {
    const { tagIds } = req.body;
    
    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({ error: 'Необходимо предоставить массив ID тегов' });
    }
    
    logger.info('ADMIN', 'Массовое удаление тегов', { tagIds, count: tagIds.length });
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Удаляем теги по одному
    for (const tagId of tagIds) {
      try {
        // Получаем информацию о теге
        const { data: tag } = await supabase
          .from('tags')
          .select('name, usage_count')
          .eq('id', tagId)
          .single();
        
        if (!tag) {
          errorCount++;
          errors.push(`Тег с ID ${tagId} не найден`);
          continue;
        }
        
        // Удаляем связи с видео
        const { error: videoTagsError } = await supabase
          .from('video_tags')
          .delete()
          .eq('tag_id', tagId);
        
        if (videoTagsError) {
          errorCount++;
          errors.push(`Ошибка удаления связей для тега ${tag.name}`);
          continue;
        }
        
        // Обновляем счетчик использования тега на 0 перед удалением
        const { error: updateError } = await supabase
          .from('tags')
          .update({ usage_count: 0 })
          .eq('id', tagId);
        
        if (updateError) {
          logger.warn('ADMIN', 'Ошибка обновления счетчика тега', { tagId, error: updateError.message });
          // Продолжаем удаление даже если не удалось обновить счетчик
        }
        
        // Удаляем тег
        const { error: deleteError } = await supabase
          .from('tags')
          .delete()
          .eq('id', tagId);
        
        if (deleteError) {
          errorCount++;
          errors.push(`Ошибка удаления тега ${tag.name}`);
          continue;
        }
        
        successCount++;
        logger.info('ADMIN', 'Тег удален', { tagId, tagName: tag.name });
        
      } catch (error) {
        errorCount++;
        errors.push(`Ошибка при удалении тега ${tagId}: ${error.message}`);
        logger.error('ADMIN', 'Ошибка удаления тега в массовой операции', { tagId, error: error.message });
      }
    }
    
    logger.info('ADMIN', 'Массовое удаление завершено', { 
      total: tagIds.length, 
      success: successCount, 
      errors: errorCount 
    });
    
    res.json({
      message: 'Массовое удаление завершено',
      total: tagIds.length,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    logger.error('ADMIN', 'Ошибка массового удаления тегов', error);
    res.status(500).json({ error: 'Ошибка массового удаления тегов' });
  }
});

/**
 * Выход из админки
 */
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      logger.error('ADMIN', 'Ошибка при выходе', err);
      return res.status(500).json({ error: 'Ошибка при выходе' });
    }
    
    req.session.destroy((err) => {
      if (err) {
        logger.error('ADMIN', 'Ошибка при уничтожении сессии', err);
        return res.status(500).json({ error: 'Ошибка при выходе' });
      }
      
      res.clearCookie('connect.sid');
      res.json({ message: 'Успешный выход' });
    });
  });
});

/**
 * Статические файлы админки
 */
router.get('/admin.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.sendFile(path.join(__dirname, '../views/admin.css'));
});

router.get('/admin.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../views/admin.js'));
});

/**
 * Генерация превью из второго кадра видео
 */
router.post('/generate-thumbnail', requireAdmin, async (req, res) => {
  try {
    const { videoUrl } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'URL видео не предоставлен' });
    }

    logger.info('ADMIN', 'Генерация превью', { videoUrl });

    // Создаем уникальное имя файла
    const thumbnailName = `admin_${Date.now()}.jpg`;

    // Генерируем превью на 2 секунде
    await new Promise((resolve, reject) => {
      ffmpeg(videoUrl)
        .screenshots({
          timestamps: ['2'],
          filename: thumbnailName,
          folder: 'uploads/thumbnails',
          size: '320x240'
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const thumbnailUrl = `${config.baseUrl}/uploads/thumbnails/${thumbnailName}`;

    logger.success('ADMIN', 'Превью успешно создано', { thumbnailUrl });
    res.json({
      success: true,
      thumbnailUrl: thumbnailUrl
    });

  } catch (error) {
    logger.error('ADMIN', 'Ошибка генерации превью', error);
    res.status(500).json({ error: 'Ошибка генерации превью' });
  }
});

module.exports = router;

