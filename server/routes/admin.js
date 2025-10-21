/**
 * Админские роуты
 */

const express = require('express');
const router = express.Router();
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
    // Получаем список админов в начале функции
    const adminIds = process.env.ADMIN_IDS?.split(',') || [];
    
    logger.info('ADMIN', 'Запрос к админке', {
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      hasUser: !!req.user,
      userId: req.user?.dbUser?.id,
      url: req.url,
      method: req.method,
      adminIds: adminIds,
      adminIdsLength: adminIds.length
    });
    
    // Если пользователь не авторизован, показываем страницу входа
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      logger.info('ADMIN', 'Пользователь не авторизован, показываем страницу входа');
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
                <div class="warning">
                    <strong>Внимание:</strong> ${adminIds.length > 0 ? 
                      'Доступ к админке имеют только пользователи, указанные в переменной ADMIN_IDS' : 
                      'Доступ разрешен всем авторизованным пользователям (ADMIN_IDS не задана)'
                    }
                </div>
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
      
      // Fallback HTML если файл не найден
      const fallbackHtml = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>GeoClips Admin Panel</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
                .error { color: #dc3545; background: #f8d7da; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
                .btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎥 GeoClips Admin Panel</h1>
                <div class="error">
                    <strong>Ошибка:</strong> Файл админки не найден. Используется резервная версия.
                </div>
                <p>Статистика:</p>
                <div id="stats">Загрузка...</div>
                <button class="btn" onclick="loadStats()">Обновить статистику</button>
            </div>
            <script>
                async function loadStats() {
                    try {
                        const response = await fetch('/admin/stats');
                        const data = await response.json();
                        document.getElementById('stats').innerHTML = 
                            \`Пользователей: \${data.usersCount || 0}<br>
                             Видео: \${data.videosCount || 0}<br>
                             Просмотров: \${data.totalViews || 0}<br>
                             Лайков: \${data.totalLikes || 0}\`;
                    } catch (error) {
                        document.getElementById('stats').innerHTML = 'Ошибка загрузки статистики';
                    }
                }
                loadStats();
            </script>
        </body>
        </html>
      `;
      res.send(fallbackHtml);
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
router.get('/stats', async (req, res) => {
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
router.get('/users', async (req, res) => {
  try {
    logger.info('ADMIN', 'Запрос списка пользователей');
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, yandex_id, first_name, last_name, display_name, avatar_url, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('ADMIN', 'Ошибка получения пользователей', error);
      return res.status(500).json({ error: 'Ошибка получения пользователей' });
    }

    logger.info('ADMIN', 'Получены пользователи', { count: users?.length || 0 });
    res.json(users || []);
  } catch (error) {
    logger.error('ADMIN', 'Ошибка получения пользователей', error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

/**
 * Получение списка видео
 */
router.get('/videos', async (req, res) => {
  try {
    logger.info('ADMIN', 'Запрос списка видео');
    
    const { data: videos, error } = await supabase
      .from('videos')
      .select(`
        id,
        user_id,
        description,
        video_url,
        thumbnail_url,
        latitude,
        longitude,
        duration_seconds,
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
      .select('video_url, thumbnail_url')
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
router.get('/tags', async (req, res) => {
  try {
    logger.info('ADMIN', 'Запрос списка тегов');
    
    const { data: tags, error } = await supabase
      .from('tags')
      .select(`
        id,
        name,
        created_at,
        video_tags (
          video_id
        )
      `)
      .order('name', { ascending: true });

    if (error) {
      logger.error('ADMIN', 'Ошибка получения тегов', error);
      return res.status(500).json({ error: 'Ошибка получения тегов' });
    }

    // Добавляем количество использований каждого тега
    const tagsWithCount = tags?.map(tag => ({
      ...tag,
      usage_count: tag.video_tags?.length || 0
    })) || [];

    logger.info('ADMIN', 'Получены теги', { count: tagsWithCount.length });
    res.json(tagsWithCount);
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
    
    // Сначала удаляем все связи тега с видео
    const { error: videoTagsError } = await supabase
      .from('video_tags')
      .delete()
      .eq('tag_id', tagId);

    if (videoTagsError) {
      logger.warn('ADMIN', 'Ошибка удаления связей тега с видео', videoTagsError);
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

    logger.info('ADMIN', 'Тег удален', { tagId });
    res.json({ message: 'Тег успешно удален' });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка удаления тега', error);
    res.status(500).json({ error: 'Ошибка удаления тега' });
  }
});

module.exports = router;

