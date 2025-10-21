/**
 * Константы приложения
 * Использует shared константы + специфичные для клиента
 */

// Импортируем shared константы (теперь из src/shared)
import * as SHARED from '../shared/constants';

// API URLs (специфично для клиента)
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://192.168.31.164:5000';
export const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://192.168.31.164:5000';

// Экспортируем shared константы
export const {
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
} = SHARED;

// Обратная совместимость
export const CACHE_TTL = CACHE_CONFIG.TTL;

