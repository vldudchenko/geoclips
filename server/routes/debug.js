/**
 * Debug роуты для тестирования и отладки
 * ВНИМАНИЕ: Использовать только в режиме разработки!
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { rateLimiter } = require('../middleware/unified');

/**
 * Middleware для проверки режима разработки
 */
const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    next();
  } else {
    res.status(403).json({ error: 'Debug routes are disabled in production' });
  }
};

// Применяем middleware ко всем debug роутам
router.use(devOnly);

/**
 * Проверка пользователей в базе данных
 */
router.get('/check-users', async (req, res) => {
  try {
    logger.debug('DEBUG', 'Проверяем пользователей в базе данных');
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, yandex_id, display_name, avatar_url, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      logger.error('DEBUG', 'Ошибка получения пользователей', error);
      return res.status(500).json({ error: 'Ошибка получения пользователей' });
    }
    
    logger.success('DEBUG', `Получено пользователей: ${users.length}`);
    
    res.json({
      success: true,
      count: users.length,
      users: users
    });
    
  } catch (error) {
    logger.error('DEBUG', 'Ошибка проверки пользователей', error);
    res.status(500).json({ error: 'Ошибка проверки пользователей' });
  }
});

/**
 * Тестовый эндпоинт для проверки RLS политик
 */
router.get('/test-rls', async (req, res) => {
  try {
    logger.debug('DEBUG', 'Тестируем RLS политики');
    
    // Тест 1: Чтение данных
    const { data: users, error: selectError } = await supabase
      .from('users')
      .select('id, yandex_id, display_name, avatar_url')
      .limit(5);
    
    const readTest = {
      success: !selectError,
      error: selectError?.message,
      count: users?.length || 0
    };
    
    logger.info('DEBUG', 'Тест чтения', readTest);
    
    // Тест 2: Проверка политик на видео
    const { data: videos, error: videoError } = await supabase
      .from('videos')
      .select('id, description, user_id')
      .limit(5);
    
    const videoTest = {
      success: !videoError,
      error: videoError?.message,
      count: videos?.length || 0
    };
    
    logger.info('DEBUG', 'Тест видео', videoTest);
    
    res.json({
      success: true,
      message: 'RLS тесты выполнены',
      results: {
        users: readTest,
        videos: videoTest
      }
    });
    
  } catch (error) {
    logger.error('DEBUG', 'Ошибка тестирования RLS', error);
    res.status(500).json({ error: 'Ошибка тестирования RLS' });
  }
});

/**
 * Проверка кэша
 */
router.get('/cache-info', (req, res) => {
  try {
    const cache = require('../utils/cacheUtils');
    
    const info = {
      size: cache.size(),
      timestamp: new Date().toISOString()
    };
    
    logger.info('DEBUG', 'Информация о кэше', info);
    
    res.json({
      success: true,
      cache: info
    });
    
  } catch (error) {
    logger.error('DEBUG', 'Ошибка получения информации о кэше', error);
    res.status(500).json({ error: 'Ошибка получения информации о кэше' });
  }
});

/**
 * Очистка всего кэша
 */
router.post('/clear-cache', (req, res) => {
  try {
    const cache = require('../utils/cacheUtils');
    cache.clear();
    
    logger.success('DEBUG', 'Кэш очищен');
    
    res.json({
      success: true,
      message: 'Кэш успешно очищен'
    });
    
  } catch (error) {
    logger.error('DEBUG', 'Ошибка очистки кэша', error);
    res.status(500).json({ error: 'Ошибка очистки кэша' });
  }
});

/**
 * Проверка окружения и конфигурации
 */
router.get('/config', (req, res) => {
  try {
    const config = require('../config/environment');
    
    // Не показываем секреты!
    const safeConfig = {
      nodeEnv: config.nodeEnv,
      port: config.port,
      baseUrl: config.baseUrl,
      clientUrl: config.clientUrl,
      cache: {
        ttl: config.cache.ttl
      },
      upload: {
        maxFileSize: config.upload.maxFileSize,
        maxFieldSize: config.upload.maxFieldSize
      }
    };
    
    logger.info('DEBUG', 'Информация о конфигурации запрошена');
    
    res.json({
      success: true,
      config: safeConfig
    });
    
  } catch (error) {
    logger.error('DEBUG', 'Ошибка получения конфигурации', error);
    res.status(500).json({ error: 'Ошибка получения конфигурации' });
  }
});

/**
 * Статистика rate limiter
 */
router.get('/rate-limit-stats', (req, res) => {
  try {
    const stats = rateLimiter.getStats();
    
    logger.info('DEBUG', 'Статистика rate limiter запрошена', { totalKeys: stats.totalKeys });
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    logger.error('DEBUG', 'Ошибка получения статистики rate limiter', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

/**
 * Сброс rate limit для конкретного ключа
 */
router.post('/reset-rate-limit', (req, res) => {
  try {
    const { key } = req.body;
    
    if (key) {
      rateLimiter.reset(key);
      logger.success('DEBUG', `Rate limit сброшен для ключа: ${key.substring(0, 20)}...`);
      
      res.json({
        success: true,
        message: `Rate limit сброшен для ключа: ${key.substring(0, 20)}...`
      });
    } else {
      // Если ключ не указан, очищаем все
      rateLimiter.requests.clear();
      logger.success('DEBUG', 'Все rate limits сброшены');
      
      res.json({
        success: true,
        message: 'Все rate limits успешно сброшены'
      });
    }
    
  } catch (error) {
    logger.error('DEBUG', 'Ошибка сброса rate limit', error);
    res.status(500).json({ error: 'Ошибка сброса rate limit' });
  }
});

module.exports = router;

