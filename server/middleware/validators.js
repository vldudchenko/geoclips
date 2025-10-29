/**
 * Middleware для валидации входных данных
 * Заменяет ненадежную regex-based защиту от SQL инъекций
 */

const { errors } = require('../constants');
const logger = require('../utils/logger');

/**
 * Проверка, является ли строка валидным UUID v4
 */
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Валидация UUID в параметрах запроса
 * @param {string|string[]} paramNames - Имя параметра или массив имен
 * @returns {Function} Express middleware
 */
function validateUUID(paramNames) {
  const names = Array.isArray(paramNames) ? paramNames : [paramNames];
  
  return (req, res, next) => {
    for (const paramName of names) {
      const value = req.params[paramName] || req.body[paramName] || req.query[paramName];
      
      if (!value) {
        // Параметр отсутствует - пропускаем валидацию
        continue;
      }
      
      if (!isValidUUID(value)) {
        logger.warn('VALIDATION', `Невалидный UUID: ${paramName}`, { value });
        return res.status(errors.INVALID_UUID.statusCode).json({
          error: `Invalid ${paramName}: must be a valid UUID`,
          code: errors.INVALID_UUID.code
        });
      }
    }
    
    next();
  };
}

/**
 * Валидация строки (длина, тип)
 * @param {string} fieldName - Имя поля
 * @param {Object} options - Опции валидации
 * @param {number} options.minLength - Минимальная длина
 * @param {number} options.maxLength - Максимальная длина
 * @param {boolean} options.required - Обязательное поле
 * @param {RegExp} options.pattern - Regex паттерн для проверки
 * @returns {Function} Express middleware
 */
function validateString(fieldName, options = {}) {
  const {
    minLength = 0,
    maxLength = 10000,
    required = false,
    pattern = null,
    trim = true
  } = options;
  
  return (req, res, next) => {
    let value = req.body[fieldName];
    
    // Проверка обязательности
    if (required && (value === undefined || value === null)) {
      return res.status(errors.VALIDATION_ERROR.statusCode).json({
        error: `Field '${fieldName}' is required`,
        code: errors.VALIDATION_ERROR.code
      });
    }
    
    // Если не обязательное и отсутствует - пропускаем
    if (!value) {
      return next();
    }
    
    // Проверка типа
    if (typeof value !== 'string') {
      return res.status(errors.VALIDATION_ERROR.statusCode).json({
        error: `Field '${fieldName}' must be a string`,
        code: errors.VALIDATION_ERROR.code
      });
    }
    
    // Trim если нужно
    if (trim) {
      value = value.trim();
      req.body[fieldName] = value;
    }
    
    // Проверка длины
    if (value.length < minLength) {
      return res.status(errors.VALIDATION_ERROR.statusCode).json({
        error: `Field '${fieldName}' must be at least ${minLength} characters`,
        code: errors.VALIDATION_ERROR.code
      });
    }
    
    if (value.length > maxLength) {
      return res.status(errors.VALIDATION_ERROR.statusCode).json({
        error: `Field '${fieldName}' must not exceed ${maxLength} characters`,
        code: errors.VALIDATION_ERROR.code
      });
    }
    
    // Проверка паттерна
    if (pattern && !pattern.test(value)) {
      return res.status(errors.VALIDATION_ERROR.statusCode).json({
        error: `Field '${fieldName}' has invalid format`,
        code: errors.VALIDATION_ERROR.code
      });
    }
    
    next();
  };
}

/**
 * Валидация числа
 * @param {string} fieldName - Имя поля
 * @param {Object} options - Опции валидации
 * @returns {Function} Express middleware
 */
function validateNumber(fieldName, options = {}) {
  const {
    min = -Infinity,
    max = Infinity,
    required = false,
    integer = false
  } = options;
  
  return (req, res, next) => {
    const value = req.body[fieldName] || req.query[fieldName];
    
    if (required && (value === undefined || value === null)) {
      return res.status(errors.VALIDATION_ERROR.statusCode).json({
        error: `Field '${fieldName}' is required`,
        code: errors.VALIDATION_ERROR.code
      });
    }
    
    if (!value && !required) {
      return next();
    }
    
    const num = Number(value);
    
    if (!Number.isFinite(num)) {
      return res.status(errors.VALIDATION_ERROR.statusCode).json({
        error: `Field '${fieldName}' must be a valid number`,
        code: errors.VALIDATION_ERROR.code
      });
    }
    
    if (integer && !Number.isInteger(num)) {
      return res.status(errors.VALIDATION_ERROR.statusCode).json({
        error: `Field '${fieldName}' must be an integer`,
        code: errors.VALIDATION_ERROR.code
      });
    }
    
    if (num < min || num > max) {
      return res.status(errors.VALIDATION_ERROR.statusCode).json({
        error: `Field '${fieldName}' must be between ${min} and ${max}`,
        code: errors.VALIDATION_ERROR.code
      });
    }
    
    // Сохраняем как число
    if (req.body[fieldName] !== undefined) {
      req.body[fieldName] = num;
    }
    if (req.query[fieldName] !== undefined) {
      req.query[fieldName] = num;
    }
    
    next();
  };
}

/**
 * Валидация массива
 * @param {string} fieldName - Имя поля
 * @param {Object} options - Опции валидации
 * @returns {Function} Express middleware
 */
function validateArray(fieldName, options = {}) {
  const {
    minLength = 0,
    maxLength = 100,
    required = false,
    itemType = null
  } = options;
  
  return (req, res, next) => {
    const value = req.body[fieldName];
    
    if (required && !value) {
      return res.status(errors.VALIDATION_ERROR.statusCode).json({
        error: `Field '${fieldName}' is required`,
        code: errors.VALIDATION_ERROR.code
      });
    }
    
    if (!value && !required) {
      return next();
    }
    
    if (!Array.isArray(value)) {
      return res.status(errors.VALIDATION_ERROR.statusCode).json({
        error: `Field '${fieldName}' must be an array`,
        code: errors.VALIDATION_ERROR.code
      });
    }
    
    if (value.length < minLength) {
      return res.status(errors.VALIDATION_ERROR.statusCode).json({
        error: `Field '${fieldName}' must have at least ${minLength} items`,
        code: errors.VALIDATION_ERROR.code
      });
    }
    
    if (value.length > maxLength) {
      return res.status(errors.VALIDATION_ERROR.statusCode).json({
        error: `Field '${fieldName}' must not exceed ${maxLength} items`,
        code: errors.VALIDATION_ERROR.code
      });
    }
    
    // Валидация типа элементов
    if (itemType) {
      const invalidItems = value.filter(item => typeof item !== itemType);
      if (invalidItems.length > 0) {
        return res.status(errors.VALIDATION_ERROR.statusCode).json({
          error: `All items in '${fieldName}' must be of type ${itemType}`,
          code: errors.VALIDATION_ERROR.code
        });
      }
    }
    
    next();
  };
}

/**
 * Комбинированная валидация нескольких полей
 * @param {Array<Function>} validators - Массив валидаторов
 * @returns {Function} Express middleware
 */
function combine(...validators) {
  return (req, res, next) => {
    let index = 0;
    
    function runNext() {
      if (index >= validators.length) {
        return next();
      }
      
      const validator = validators[index++];
      validator(req, res, runNext);
    }
    
    runNext();
  };
}

module.exports = {
  validateUUID,
  validateString,
  validateNumber,
  validateArray,
  combine,
  isValidUUID
};

