/**
 * Middleware для обработки ошибок
 */

const logger = require('../utils/logger');
const multer = require('multer');

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
                      req.url.includes('.json');
  
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

module.exports = {
  handleMulterError,
  errorHandler,
  notFoundHandler
};

