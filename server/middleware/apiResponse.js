/**
 * Утилиты для стандартизированных API ответов
 * Повышает консистентность и снижает дублирование кода в роутерах
 */

const logger = require('../utils/logger');

/**
 * Отправить успешный ответ
 * @param {Object} res - Express response объект
 * @param {*} data - данные для отправки
 * @param {Object} options - дополнительные опции
 */
const sendSuccess = (res, data = {}, options = {}) => {
  const { 
    statusCode = 200, 
    message = undefined,
    meta = undefined 
  } = options;

  const response = {
    success: true,
    ...data
  };

  if (message) {
    response.message = message;
  }
  if (meta) {
    response.meta = meta;
  }

  res.status(statusCode).json(response);
};

/**
 * Отправить ошибку
 * @param {Object} res - Express response объект
 * @param {string|Object} error - сообщение об ошибке или объект ошибки
 * @param {Object} options - дополнительные опции
 */
const sendError = (res, error, options = {}) => {
  const {
    statusCode = 500,
    code = 'ERROR',
    operation = 'Unknown operation'
  } = options;

  let errorMessage = error;
  
  if (typeof error === 'object' && error.message) {
    errorMessage = error.message;
  }

  logger.error(code, `Ошибка ${operation}`, error);

  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    code: code
  });
};

/**
 * Обработчик для async роутов с автоматическим перехватом ошибок
 * @param {Function} handler - async функция обработчик
 * @returns {Function} Express middleware
 */
const asyncHandler = (handler) => {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      logger.error('HANDLER', 'Необработанная ошибка в роуте', error);
      sendError(res, error, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        operation: req.path
      });
    }
  };
};

/**
 * Валидировать необходимые параметры
 * @param {Object} data - объект с данными
 * @param {string[]} requiredFields - необходимые поля
 * @returns {string|null} сообщение об ошибке или null
 */
const validateRequired = (data, requiredFields) => {
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length > 0) {
    return `Необходимы следующие поля: ${missing.join(', ')}`;
  }
  return null;
};

/**
 * Валидировать данные по схеме
 * @param {Object} data - данные для проверки
 * @param {Object} schema - схема валидации {field: type|validator}
 * @returns {string|null} сообщение об ошибке или null
 */
const validateSchema = (data, schema) => {
  for (const [field, validator] of Object.entries(schema)) {
    if (typeof validator === 'string') {
      // Проверка типа
      if (typeof data[field] !== validator) {
        return `Поле '${field}' должно быть типа '${validator}'`;
      }
    } else if (typeof validator === 'function') {
      // Пользовательская проверка
      const error = validator(data[field]);
      if (error) {
        return error;
      }
    }
  }
  return null;
};

/**
 * Обработчик для GET запроса с pagination
 * @param {Object} query - параметры запроса
 * @returns {Object} объект с limit, offset и другими параметрами
 */
const getPaginationParams = (query) => {
  const limit = Math.min(parseInt(query.limit) || 50, 500);
  const offset = Math.max(parseInt(query.offset) || 0, 0);
  const sortBy = query.sortBy || 'created_at';
  const order = query.order === 'asc' ? 'asc' : 'desc';

  return { limit, offset, sortBy, order };
};

/**
 * Форматировать результаты с пагинацией
 * @param {Array} data - данные
 * @param {number} total - общее количество
 * @param {number} limit - лимит
 * @param {number} offset - смещение
 * @returns {Object} отформатированный результат
 */
const formatPaginatedResponse = (data, total, limit, offset) => {
  return {
    data,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    }
  };
};

module.exports = {
  sendSuccess,
  sendError,
  asyncHandler,
  validateRequired,
  validateSchema,
  getPaginationParams,
  formatPaginatedResponse
};
