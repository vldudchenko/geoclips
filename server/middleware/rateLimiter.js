/**
 * Rate Limiting middleware
 * РЕЖИМ: Только подсчёт запросов (без блокировки)
 * Используется для сбора статистики и мониторинга
 */

const logger = require('../utils/logger');

class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.cleanupInterval = 60000; // Очистка каждую минуту
    
    // Автоматическая очистка старых записей
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  /**
   * Очистка устаревших записей
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, data] of this.requests.entries()) {
      if (now - data.resetTime > 60000) {
        this.requests.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('RATE_LIMITER', `Очищено устаревших записей: ${cleaned}`);
    }
  }

  /**
   * Создать middleware для ограничения запросов
   * @param {Object} options - Опции
   * @param {number} options.windowMs - Окно времени в мс (по умолчанию 60000 = 1 минута)
   * @param {number} options.maxRequests - Максимум запросов в окне (по умолчанию 100)
   * @param {string} options.message - Сообщение об ошибке
   */
  create(options = {}) {
    const {
      windowMs = 60000, // 1 минута
      maxRequests = 100,
      message = 'Слишком много запросов. Попробуйте позже.'
    } = options;

    return (req, res, next) => {
      const key = this.getKey(req);
      const now = Date.now();
      
      let requestData = this.requests.get(key);
      
      // Если записи нет или окно истекло - создаем новую
      if (!requestData || now - requestData.resetTime > windowMs) {
        requestData = {
          count: 0,
          resetTime: now
        };
        this.requests.set(key, requestData);
      }
      
      requestData.count++;
      
      // Проверяем лимит: в продакшене блокируем, в дев-режиме только логируем
      if (requestData.count > maxRequests) {
        const isProd = process.env.NODE_ENV === 'production';
        logger.info('RATE_LIMITER', `📊 Лимит превышен (${requestData.count}/${maxRequests})`, {
          key: key.substring(0, 50) + '...',
          count: requestData.count,
          maxRequests,
          url: req.url,
          method: req.method,
          env: process.env.NODE_ENV
        });

        if (isProd) {
          return res.status(429).json({
            error: message,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((windowMs - (now - requestData.resetTime)) / 1000)
          });
        }
      }
      
      // Логируем каждый 10-й запрос для мониторинга
      if (requestData.count % 10 === 0) {
        logger.debug('RATE_LIMITER', `📊 Статистика: ${requestData.count} запросов`);
      }
      
      // Добавляем заголовки
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - requestData.count);
      res.setHeader('X-RateLimit-Reset', new Date(requestData.resetTime + windowMs).toISOString());
      
      next();
    };
  }

  /**
   * Получить ключ для идентификации клиента
   */
  getKey(req) {
    // Используем IP + User Agent для идентификации
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || 'unknown';
    return `${ip}_${userAgent}`;
  }

  /**
   * Сбросить счетчик для ключа
   */
  reset(key) {
    this.requests.delete(key);
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      totalKeys: this.requests.size,
      requests: Array.from(this.requests.entries()).map(([key, data]) => ({
        key: key.substring(0, 50) + '...', // Обрезаем для безопасности
        count: data.count,
        resetTime: new Date(data.resetTime).toISOString()
      }))
    };
  }
}

// Создаем единственный экземпляр
const rateLimiter = new RateLimiter();

// Предустановленные лимиты для разных типов запросов
// ВАЖНО: Лимиты отключены, работает только подсчёт запросов для статистики
const limiters = {
  // Счётчик для авторизации
  auth: rateLimiter.create({
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 5 * 60 * 1000,
    maxRequests: process.env.NODE_ENV === 'production' ? 5 : 50,
    message: 'Слишком много попыток входа. Попробуйте позже.'
  }),

  // Счётчик для API
  api: rateLimiter.create({
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 200,
    message: 'Слишком много запросов к API. Попробуйте через минуту.'
  }),

  // Счётчик для загрузки файлов
  upload: rateLimiter.create({
    windowMs: 60 * 60 * 1000, // 1 час
    maxRequests: 50,
    message: 'Слишком много загрузок. Попробуйте через час.'
  }),

  // Счётчик для чтения данных
  read: rateLimiter.create({
    windowMs: 60 * 1000, // 1 минута
    maxRequests: 200,
    message: 'Слишком много запросов. Попробуйте через минуту.'
  })
};

module.exports = {
  rateLimiter,
  limiters
};

