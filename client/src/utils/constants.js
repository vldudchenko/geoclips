/**
 * Константы приложения
 * Использует shared константы + специфичные для клиента
 */

// Импортируем shared константы (теперь из src/shared)
import * as SHARED from '../shared/constants';

// API URLs (специфично для клиента)
const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
const defaultServer = `http://${host}:5000`;
export const API_BASE_URL = process.env.REACT_APP_API_URL || defaultServer;
export const SERVER_URL = process.env.REACT_APP_SERVER_URL || defaultServer;

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

