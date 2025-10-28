/**
 * Объединенные middleware для упрощения структуры
 * Содержит все основные middleware в одном файле
 */

const logger = require('../utils/logger');
const config = require('../config/environment');
const { authenticateWithBearerToken } = require('../services/authService');
const multer = require('multer');

// ==================== АВТОРИЗАЦИЯ ====================

/**
 * Проверка, что пользователь авторизован
 */
const requireAuth = async (req, res, next) => {
  try {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return next();
    }

    // Dev-путь: поддержка Bearer токена Яндекс для совместимости клиента
    const authHeader = req.get('authorization') || req.get('Authorization');
    const allowBearer = config.nodeEnv !== 'production' || config.features.allowProfileLookupByAccessToken;
    
    if (allowBearer && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring('Bearer '.length).trim();
      if (token) {
        try {
          const user = await authenticateWithBearerToken(token);
          req.user = user;
          return next();
        } catch (e) {
          logger.warn('AUTH', 'Неверный Bearer токен', { message: e.message });
        }
      }
    }

    logger.warn('AUTH', 'Попытка доступа без авторизации', {
      url: req.url,
      method: req.method,
      ip: req.ip
    });
    res.status(401).json({ 
      error: 'Требуется авторизация',
      code: 'UNAUTHORIZED'
    });
  } catch (error) {
    logger.error('AUTH', 'Ошибка в requireAuth', error);
    res.status(500).json({ error: 'Ошибка проверки авторизации' });
  }
};

/**
 * Опциональная авторизация (не требует обязательной авторизации)
 */
const optionalAuth = (req, res, next) => {
  // Просто продолжаем, даже если не авторизован
  next();
};

/**
 * Проверка роли администратора
 */
const requireAdmin = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    logger.warn('AUTH', 'Попытка доступа к админке без авторизации, пернаправление на страницу входа');
    // Перенаправляем на страницу входа вместо JSON ошибки
    return res.redirect('/auth/login');
  }
  
  // Проверяем права администратора
  const adminIds = config.admin.ids;
  const userId = req.user?.dbUser?.id;
  
  // Если ADMIN_IDS не задана, разрешаем доступ всем авторизованным пользователям
  if (adminIds.length > 0 && !adminIds.includes(userId)) {
    logger.warn('AUTH', 'Попытка доступа к админке без прав', { userId, adminIds });
    return res.status(403).json({ 
      error: 'Доступ запрещен - недостаточно прав', 
      code: 'FORBIDDEN' 
    });
  }
  
  next();
};

// ==================== ВАЛИДАЦИЯ ====================

/**
 * Валидация координат
 */
const validateCoordinates = (req, res, next) => {
  const { latitude, longitude } = req.body;

  if (latitude === undefined || longitude === undefined) {
    logger.warn('VALIDATION', 'Координаты не предоставлены');
    return res.status(400).json({ error: 'Координаты обязательны' });
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  if (!isValidCoordinates(lat, lon)) {
    logger.warn('VALIDATION', 'Невалидные координаты', { latitude: lat, longitude: lon });
    return res.status(400).json({ error: 'Невалидные координаты' });
  }

  req.body.latitude = lat;
  req.body.longitude = lon;
  next();
};

/**
 * Валидация токена доступа
 */
const validateAccessToken = (req, res, next) => {
  let accessToken = req.body?.accessToken || req.query?.accessToken;

  // Нормализуем значения 'undefined'/'null' строк
  if (typeof accessToken === 'string') {
    const normalized = accessToken.trim().toLowerCase();
    if (normalized === 'undefined' || normalized === 'null' || normalized === '') {
      accessToken = undefined;
    }
  }

  // Фоллбэк к токену из сессии
  if (!accessToken && req.user?.accessToken) {
    req.accessToken = req.user.accessToken;
    return next();
  }

  if (!accessToken) {
    logger.warn('VALIDATION', 'Токен доступа не предоставлен');
    return res.status(400).json({ error: 'Токен доступа не предоставлен' });
  }

  req.accessToken = accessToken;
  next();
};

/**
 * Валидация адреса для геокодирования
 */
const validateAddress = (req, res, next) => {
  const { address } = req.body;

  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    logger.warn('VALIDATION', 'Адрес не указан');
    return res.status(400).json({ error: 'Адрес не указан' });
  }

  req.body.address = address.trim();
  next();
};

/**
 * Валидация файла
 */
const validateFile = (fieldName) => (req, res, next) => {
  if (!req.file) {
    logger.warn('VALIDATION', 'Файл не загружен', { fieldName });
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  next();
};

// ==================== БЕЗОПАСНОСТЬ ====================

/**
 * Sanitize входные данные
 * Защита от XSS и инъекций
 */
const sanitizeInput = (req, res, next) => {
  // Рекурсивная очистка объекта
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Удаляем потенциально опасные символы
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj !== null && typeof obj === 'object') {
      const cleaned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cleaned[key] = sanitize(obj[key]);
        }
      }
      return cleaned;
    }
    
    return obj;
  };

  // Очищаем body, query и params
  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};

/**
 * Проверка размера запроса
 */
const checkRequestSize = (maxSize = 10 * 1024 * 1024) => {
  return (req, res, next) => {
    const contentLength = req.get('content-length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      logger.warn('SECURITY', 'Слишком большой запрос', {
        contentLength,
        maxSize,
        url: req.url
      });
      
      return res.status(413).json({
        error: 'Запрос слишком большой',
        code: 'PAYLOAD_TOO_LARGE',
        maxSize: `${Math.round(maxSize / 1024 / 1024)}MB`
      });
    }
    
    next();
  };
};

/**
 * Защита от SQL инъекций
 */
const preventSqlInjection = (req, res, next) => {
  const sqlPatterns = [
    /(\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bcreate\b|\balter\b).*(\bfrom\b|\binto\b|\btable\b)/i,
    /union.*select/i,
    /;\s*(drop|delete|insert|update)/i,
    /'\s*(or|and)\s*'?\d/i,
    /--/,
    /\/\*/
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    }
    return false;
  };

  const checkObject = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        
        if (checkValue(value)) {
          return true;
        }
        
        if (typeof value === 'object' && value !== null) {
          if (checkObject(value)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // Проверяем все входные данные
  const suspicious = checkObject(req.body) || checkObject(req.query) || checkObject(req.params);
  
  if (suspicious) {
    logger.error('SECURITY', 'Обнаружена попытка SQL инъекции', {
      url: req.url,
      method: req.method,
      ip: req.ip,
      body: req.body,
      query: req.query
    });
    
    return res.status(400).json({
      error: 'Недопустимые данные',
      code: 'INVALID_INPUT'
    });
  }

  next();
};

/**
 * Установка security заголовков
 */
const setSecurityHeaders = (req, res, next) => {
  // Защита от clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Защита от MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS защита
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (расширенная)
  // Разрешаем загрузку карт, аватаров Yandex и Supabase storage
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://api-maps.yandex.ru",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: https://avatars.yandex.net https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co https://login.yandex.ru https://oauth.yandex.ru",
    "font-src 'self' data:",
    "frame-ancestors 'none'"
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  
  next();
};

/**
 * Логирование подозрительной активности
 */
const logSuspiciousActivity = (req, res, next) => {
  const suspiciousPatterns = [
    /\.\.\//,  // Path traversal
    /etc\/passwd/,
    /cmd\.exe/i,
    /powershell/i,
    /<script/i
  ];

  const url = req.url.toLowerCase();
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(url));

  if (isSuspicious) {
    logger.warn('SECURITY', 'Подозрительная активность обнаружена', {
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  }

  next();
};

// ==================== ОБРАБОТКА ОШИБОК ====================

/**
 * Обработчик ошибок multer
 */
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    logger.error('MULTER', 'Ошибка multer', { code: error.code, message: error.message });
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: 'Файл слишком большой. Максимальный размер: 50 МБ',
          code: 'FILE_TOO_LARGE',
          maxSize: '50MB'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Слишком много файлов. Максимум: 1 файл',
          code: 'TOO_MANY_FILES'
        });
      case 'LIMIT_FIELD_VALUE':
        return res.status(400).json({
          error: 'Поле формы слишком большое',
          code: 'FIELD_TOO_LARGE'
        });
      default:
        return res.status(400).json({
          error: 'Ошибка загрузки файла: ' + error.message,
          code: error.code
        });
    }
  }
  next(error);
};

/**
 * Общий обработчик ошибок
 */
const errorHandler = (error, req, res, next) => {
  logger.error('SERVER', 'Необработанная ошибка', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  // Проверяем, не был ли уже отправлен ответ
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Внутренняя ошибка сервера';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

/**
 * Обработчик 404 ошибок
 */
const notFoundHandler = (req, res) => {
  // Не логируем статические файлы в режиме разработки
  const isStaticFile = req.url.includes('.hot-update.') || 
                      req.url.includes('.js') || 
                      req.url.includes('.css') || 
                      req.url.includes('.map') ||
                      req.url.includes('.json') ||
                      req.url.includes('.ico') ||
                      req.url.includes('.png') ||
                      req.url.includes('.jpg') ||
                      req.url.includes('.jpeg') ||
                      req.url.includes('.gif') ||
                      req.url.includes('.svg') ||
                      req.url.includes('.woff') ||
                      req.url.includes('.woff2') ||
                      req.url.includes('.ttf') ||
                      req.url.includes('.eot');
  
  if (!isStaticFile || process.env.NODE_ENV === 'production') {
    logger.warn('SERVER', 'Маршрут не найден', {
      url: req.url,
      method: req.method
    });
  }
  
  res.status(404).json({
    error: 'Маршрут не найден',
    path: req.url
  });
};

// ==================== RATE LIMITING ====================

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
  
}

// Создаем единственный экземпляр
const rateLimiter = new RateLimiter();

// Предустановленные лимиты для разных типов запросов
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

// ==================== УТИЛИТЫ ====================

/**
 * Проверка валидности координат
 */
const isValidCoordinates = (lat, lon) => {
  return isFinite(lat) && isFinite(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180;
};

// ==================== ЭКСПОРТ ====================

module.exports = {
  // Авторизация
  requireAuth,
  optionalAuth,
  requireAdmin,
  
  // Валидация
  validateCoordinates,
  validateAccessToken,
  validateAddress,
  validateFile,
  
  // Безопасность
  sanitizeInput,
  checkRequestSize,
  preventSqlInjection,
  setSecurityHeaders,
  logSuspiciousActivity,
  
  // Обработка ошибок
  handleMulterError,
  errorHandler,
  notFoundHandler,
  
  // Rate limiting
  rateLimiter,
  limiters,
  
  // Утилиты
  isValidCoordinates
};
