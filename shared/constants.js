/**
 * Общие константы для клиента и сервера
 * Используется для обеспечения консистентности
 */

// Лимиты видео
const VIDEO_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_DURATION: 60, // секунд
  MIN_DURATION: 1, // секунда
  ALLOWED_TYPES: [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/quicktime',
    'video/x-quicktime',
    'video/wmv',
    'video/webm',
    'video/3gpp',
    'video/x-msvideo'
  ],
  ALLOWED_EXTENSIONS: ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.3gp']
};

// Лимиты изображений
const IMAGE_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp']
};

// Географические лимиты
const GEO_LIMITS = {
  MIN_LATITUDE: -90,
  MAX_LATITUDE: 90,
  MIN_LONGITUDE: -180,
  MAX_LONGITUDE: 180,
  DEFAULT_ZOOM: 10,
  MIN_ZOOM: 1,
  MAX_ZOOM: 20
};

// Лимиты текста
const TEXT_LIMITS = {
  DESCRIPTION_MIN: 0,
  DESCRIPTION_MAX: 500,
  TAG_MIN: 2,
  TAG_MAX: 20,
  MAX_TAGS: 10,
  USERNAME_MIN: 2,
  USERNAME_MAX: 50
};

// Коды ошибок
const ERROR_CODES = {
  // Авторизация
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Валидация
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_COORDINATES: 'INVALID_COORDINATES',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  VIDEO_TOO_LONG: 'VIDEO_TOO_LONG',
  
  // Ресурсы
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Сервер
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
};

// Сообщения об ошибках (русские)
const ERROR_MESSAGES = {
  // Авторизация
  [ERROR_CODES.UNAUTHORIZED]: 'Требуется авторизация',
  [ERROR_CODES.FORBIDDEN]: 'Доступ запрещен',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Сессия истекла. Войдите снова.',
  
  // Валидация
  [ERROR_CODES.INVALID_INPUT]: 'Некорректные данные',
  [ERROR_CODES.INVALID_COORDINATES]: 'Некорректные координаты',
  [ERROR_CODES.INVALID_FILE_TYPE]: 'Неподдерживаемый тип файла',
  [ERROR_CODES.FILE_TOO_LARGE]: `Файл слишком большой. Максимум: ${VIDEO_LIMITS.MAX_FILE_SIZE / 1024 / 1024}МБ`,
  [ERROR_CODES.VIDEO_TOO_LONG]: `Видео слишком длинное. Максимум: ${VIDEO_LIMITS.MAX_DURATION}с`,
  
  // Ресурсы
  [ERROR_CODES.NOT_FOUND]: 'Ресурс не найден',
  [ERROR_CODES.ALREADY_EXISTS]: 'Ресурс уже существует',
  
  // Сервер
  [ERROR_CODES.INTERNAL_ERROR]: 'Внутренняя ошибка сервера',
  [ERROR_CODES.DATABASE_ERROR]: 'Ошибка базы данных',
  [ERROR_CODES.NETWORK_ERROR]: 'Ошибка сети. Проверьте подключение.',
  
  // Rate limiting
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Слишком много запросов. Попробуйте позже.'
};

// HTTP статус коды
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
};

// Настройки кэша
const CACHE_CONFIG = {
  TTL: 5 * 60 * 1000, // 5 минут
  CLEANUP_INTERVAL: 2 * 60 * 1000 // 2 минуты
};

// Настройки пагинации
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

// Роли пользователей
const USER_ROLES = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin'
};

// Статусы видео
const VIDEO_STATUS = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  PUBLISHED: 'published',
  REJECTED: 'rejected'
};

// События для логирования
const LOG_EVENTS = {
  // Видео
  VIDEO_UPLOADED: 'video_uploaded',
  VIDEO_VIEWED: 'video_viewed',
  VIDEO_LIKED: 'video_liked',
  VIDEO_DELETED: 'video_deleted',
  
  // Пользователи
  USER_REGISTERED: 'user_registered',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  
  // Безопасность
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  RATE_LIMIT_HIT: 'rate_limit_hit',
  SQL_INJECTION_ATTEMPT: 'sql_injection_attempt'
};

// Экспорт для Node.js и браузера
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VIDEO_LIMITS,
    IMAGE_LIMITS,
    GEO_LIMITS,
    TEXT_LIMITS,
    ERROR_CODES,
    ERROR_MESSAGES,
    HTTP_STATUS,
    CACHE_CONFIG,
    PAGINATION,
    USER_ROLES,
    VIDEO_STATUS,
    LOG_EVENTS
  };
} else if (typeof window !== 'undefined') {
  window.SHARED_CONSTANTS = {
    VIDEO_LIMITS,
    IMAGE_LIMITS,
    GEO_LIMITS,
    TEXT_LIMITS,
    ERROR_CODES,
    ERROR_MESSAGES,
    HTTP_STATUS,
    CACHE_CONFIG,
    PAGINATION,
    USER_ROLES,
    VIDEO_STATUS,
    LOG_EVENTS
  };
}

