/**
 * Security middleware
 * Дополнительные проверки безопасности
 */

const logger = require('../utils/logger');

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

module.exports = {
  sanitizeInput,
  checkRequestSize,
  preventSqlInjection,
  setSecurityHeaders,
  logSuspiciousActivity
};

