/**
 * Стандартизированные коды и сообщения ошибок
 * Используются для консистентности API responses
 */

module.exports = {
  // Аутентификация и авторизация
  UNAUTHORIZED: {
    statusCode: 401,
    code: 'UNAUTHORIZED',
    message: 'Требуется авторизация'
  },
  
  FORBIDDEN: {
    statusCode: 403,
    code: 'FORBIDDEN',
    message: 'Недостаточно прав для выполнения операции'
  },
  
  // Not Found
  NOT_FOUND: {
    statusCode: 404,
    code: 'NOT_FOUND',
    message: 'Ресурс не найден'
  },
  
  VIDEO_NOT_FOUND: {
    statusCode: 404,
    code: 'VIDEO_NOT_FOUND',
    message: 'Видео не найдено'
  },
  
  USER_NOT_FOUND: {
    statusCode: 404,
    code: 'USER_NOT_FOUND',
    message: 'Пользователь не найден'
  },
  
  TAG_NOT_FOUND: {
    statusCode: 404,
    code: 'TAG_NOT_FOUND',
    message: 'Тег не найден'
  },
  
  COMMENT_NOT_FOUND: {
    statusCode: 404,
    code: 'COMMENT_NOT_FOUND',
    message: 'Комментарий не найден'
  },
  
  // Валидация
  VALIDATION_ERROR: {
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: 'Ошибка валидации данных'
  },
  
  INVALID_COORDINATES: {
    statusCode: 400,
    code: 'INVALID_COORDINATES',
    message: 'Невалидные координаты'
  },
  
  INVALID_UUID: {
    statusCode: 400,
    code: 'INVALID_UUID',
    message: 'Невалидный UUID'
  },
  
  INVALID_INPUT: {
    statusCode: 400,
    code: 'INVALID_INPUT',
    message: 'Недопустимые входные данные'
  },
  
  // File Upload
  FILE_NOT_UPLOADED: {
    statusCode: 400,
    code: 'FILE_NOT_UPLOADED',
    message: 'Файл не загружен'
  },
  
  FILE_TOO_LARGE: {
    statusCode: 400,
    code: 'FILE_TOO_LARGE',
    message: 'Файл слишком большой'
  },
  
  UNSUPPORTED_FILE_TYPE: {
    statusCode: 400,
    code: 'UNSUPPORTED_FILE_TYPE',
    message: 'Неподдерживаемый тип файла'
  },
  
  // Конфликты
  ALREADY_EXISTS: {
    statusCode: 409,
    code: 'ALREADY_EXISTS',
    message: 'Ресурс уже существует'
  },
  
  ALREADY_LIKED: {
    statusCode: 400,
    code: 'ALREADY_LIKED',
    message: 'Видео уже лайкнуто'
  },
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: {
    statusCode: 429,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Слишком много запросов. Попробуйте позже.'
  },
  
  // Серверные ошибки
  INTERNAL_ERROR: {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Внутренняя ошибка сервера'
  },
  
  DATABASE_ERROR: {
    statusCode: 500,
    code: 'DATABASE_ERROR',
    message: 'Ошибка базы данных'
  },
  
  // Timeout
  REQUEST_TIMEOUT: {
    statusCode: 408,
    code: 'REQUEST_TIMEOUT',
    message: 'Превышено время ожидания запроса'
  },
  
  PAYLOAD_TOO_LARGE: {
    statusCode: 413,
    code: 'PAYLOAD_TOO_LARGE',
    message: 'Запрос слишком большой'
  }
};

