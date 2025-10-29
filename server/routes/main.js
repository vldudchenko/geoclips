/**
 * Основные роуты админ панели (главная страница, статика, тест)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { readFile, access } = require('fs').promises;
const logger = require('../utils/logger');
const { requireAdmin } = require('../middleware/unified');

/**
 * Главная страница админки
 */
router.get('/', requireAdmin, async (req, res) => {
  try {

    
    logger.info('ADMIN', 'Запрос к админке');
    
    // На этом этапе пользователь уже авторизован и имеет права администратора
    // (проверено в requireAdmin middleware)
    
    try {
      const htmlPath = path.join(__dirname, '../views/admin.html');
      logger.info('ADMIN', 'Загрузка админки');
      
      // Проверяем существование файла
      try {
        await access(htmlPath);
      } catch (accessError) {
        logger.error('ADMIN', 'Файл админки не найден', { htmlPath, error: accessError.message });
        throw new Error(`Файл админки не найден: ${htmlPath}`);
      }
      
      const html = await readFile(htmlPath, 'utf-8');
      res.send(html);
      logger.success('ADMIN', 'Админка загружена');
    } catch (fileError) {
      logger.error('ADMIN', 'Ошибка чтения файла админки', fileError);      
    }
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки админ панели', { 
      message: error.message, 
      stack: error.stack,
      userId: req.user?.dbUser?.id
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
 * Получение списка видео для дашборда
 */
router.get('/videos', requireAdmin, async (req, res) => {
  try {
    const supabase = require('../config/supabase');
    
    const { data: videos, error } = await supabase
      .from('videos')
      .select(`
        id, 
        description, 
        video_url, 
        created_at, 
        user_id, 
        views_count, 
        likes_count, 
        comments_count,
        latitude,
        longitude,
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Получаем количество тегов для каждого видео
    const videoIds = videos?.map(v => v.id) || [];
    let tagsCountMap = {};
    
    if (videoIds.length > 0) {
      const { data: tagCounts, error: tagError } = await supabase
        .from('video_tags')
        .select('video_id')
        .in('video_id', videoIds);
      
      if (!tagError && tagCounts) {
        tagsCountMap = tagCounts.reduce((acc, item) => {
          acc[item.video_id] = (acc[item.video_id] || 0) + 1;
          return acc;
        }, {});
      }
    }
    
    // Добавляем tags_count к каждому видео
    const videosWithTags = videos?.map(video => ({
      ...video,
      tags_count: tagsCountMap[video.id] || 0
    }));
    
    res.json({ success: true, videos: videosWithTags || [] });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки видео', error);
    res.status(500).json({ success: false, error: 'Ошибка загрузки видео' });
  }
});

/**
 * Получение списка комментариев для дашборда
 */
router.get('/comments', requireAdmin, async (req, res) => {
  try {
    const supabase = require('../config/supabase');
    
    const { data: comments, error } = await supabase
      .from('comments')
      .select('id, text, created_at, user_id, video_id')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ success: true, comments: comments || [] });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки комментариев', error);
    res.status(500).json({ success: false, error: 'Ошибка загрузки комментариев' });
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
 * Получение деталей одного видео
 */
router.get('/videos/:id', requireAdmin, async (req, res) => {
  try {
    const supabase = require('../config/supabase');
    const { id } = req.params;
    
    const { data: video, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !video) {
      return res.status(404).json({ error: 'Видео не найдено' });
    }
    
    res.json(video);
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки видео', error);
    res.status(500).json({ error: 'Ошибка загрузки видео' });
  }
});

/**
 * Получение тегов видео
 */
router.get('/videos/:id/tags', requireAdmin, async (req, res) => {
  try {
    const supabase = require('../config/supabase');
    const { id } = req.params;
    
    const { data: tags, error } = await supabase
      .from('video_tags')
      .select(`
        tag_id,
        tags:tag_id (
          id,
          name
        )
      `)
      .eq('video_id', id);
    
    if (error) throw error;
    
    const tagsList = tags?.map(vt => vt.tags).filter(Boolean) || [];
    res.json({ tags: tagsList });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки тегов видео', error);
    res.json({ tags: [] });
  }
});

/**
 * Получение лайков видео
 */
router.get('/videos/:id/likes', requireAdmin, async (req, res) => {
  try {
    const supabase = require('../config/supabase');
    const { id } = req.params;
    
    const { data: likes, error } = await supabase
      .from('likes')
      .select('user_id, created_at')
      .eq('video_id', id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ likes: likes || [] });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки лайков видео', error);
    res.json({ likes: [] });
  }
});

/**
 * Получение комментариев видео
 */
router.get('/videos/:id/comments', requireAdmin, async (req, res) => {
  try {
    const supabase = require('../config/supabase');
    const { id } = req.params;
    
    const { data: comments, error } = await supabase
      .from('comments')
      .select('id, text, user_id, created_at')
      .eq('video_id', id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ comments: comments || [] });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки комментариев видео', error);
    res.json({ comments: [] });
  }
});

/**
 * Получение просмотров видео
 */
router.get('/videos/:id/views', requireAdmin, async (req, res) => {
  try {
    const supabase = require('../config/supabase');
    const { id } = req.params;
    
    const { data: views, error } = await supabase
      .from('views')
      .select('user_id, created_at')
      .eq('video_id', id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ views: views || [] });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки просмотров видео', error);
    res.json({ views: [] });
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

module.exports = router;

