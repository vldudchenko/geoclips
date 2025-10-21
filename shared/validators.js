/**
 * Общие валидаторы для клиента и сервера
 */

const constants = require('./constants');

/**
 * Валидация email
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Валидация координат
 */
const isValidCoordinates = (lat, lon) => {
  const { MIN_LATITUDE, MAX_LATITUDE, MIN_LONGITUDE, MAX_LONGITUDE } = constants.GEO_LIMITS;
  
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    isFinite(lat) &&
    isFinite(lon) &&
    lat >= MIN_LATITUDE &&
    lat <= MAX_LATITUDE &&
    lon >= MIN_LONGITUDE &&
    lon <= MAX_LONGITUDE
  );
};

/**
 * Валидация типа файла видео
 */
const isValidVideoType = (mimeType, filename) => {
  const { ALLOWED_TYPES, ALLOWED_EXTENSIONS } = constants.VIDEO_LIMITS;
  
  // Проверка MIME типа
  if (ALLOWED_TYPES.includes(mimeType)) {
    return true;
  }
  
  // Проверка расширения
  if (filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return ALLOWED_EXTENSIONS.includes(ext);
  }
  
  return false;
};

/**
 * Валидация размера файла
 */
const isValidFileSize = (size, maxSize = constants.VIDEO_LIMITS.MAX_FILE_SIZE) => {
  return typeof size === 'number' && size > 0 && size <= maxSize;
};

/**
 * Валидация длины текста
 */
const isValidTextLength = (text, min, max) => {
  if (typeof text !== 'string') return false;
  const length = text.trim().length;
  return length >= min && length <= max;
};

/**
 * Валидация описания
 */
const isValidDescription = (description) => {
  const { DESCRIPTION_MIN, DESCRIPTION_MAX } = constants.TEXT_LIMITS;
  return isValidTextLength(description, DESCRIPTION_MIN, DESCRIPTION_MAX);
};

/**
 * Валидация тега
 */
const isValidTag = (tag) => {
  const { TAG_MIN, TAG_MAX } = constants.TEXT_LIMITS;
  
  if (!isValidTextLength(tag, TAG_MIN, TAG_MAX)) {
    return false;
  }
  
  // Только буквы, цифры, дефис и подчеркивание
  const tagRegex = /^[a-zA-Zа-яА-Я0-9_-]+$/;
  return tagRegex.test(tag.trim());
};

/**
 * Валидация массива тегов
 */
const isValidTags = (tags) => {
  const { MAX_TAGS } = constants.TEXT_LIMITS;
  
  if (!Array.isArray(tags)) {
    return false;
  }
  
  if (tags.length > MAX_TAGS) {
    return false;
  }
  
  return tags.every(tag => isValidTag(tag));
};

/**
 * Валидация UUID
 */
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Валидация URL
 */
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Валидация ID пользователя Яндекс
 */
const isValidYandexId = (id) => {
  return typeof id === 'string' && id.length > 0;
};

/**
 * Санитизация строки (удаление опасных символов)
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

/**
 * Валидация объекта видео для загрузки
 */
const validateVideoUpload = (videoData) => {
  const errors = {};
  
  // Координаты обязательны
  if (!videoData.latitude || !videoData.longitude) {
    errors.coordinates = 'Координаты обязательны';
  } else if (!isValidCoordinates(videoData.latitude, videoData.longitude)) {
    errors.coordinates = 'Некорректные координаты';
  }
  
  // Описание опционально, но если есть - валидируем
  if (videoData.description && !isValidDescription(videoData.description)) {
    errors.description = `Описание должно быть от ${constants.TEXT_LIMITS.DESCRIPTION_MIN} до ${constants.TEXT_LIMITS.DESCRIPTION_MAX} символов`;
  }
  
  // Теги опциональны, но если есть - валидируем
  if (videoData.tags && !isValidTags(videoData.tags)) {
    errors.tags = `Максимум ${constants.TEXT_LIMITS.MAX_TAGS} тегов, каждый от ${constants.TEXT_LIMITS.TAG_MIN} до ${constants.TEXT_LIMITS.TAG_MAX} символов`;
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isValidEmail,
    isValidCoordinates,
    isValidVideoType,
    isValidFileSize,
    isValidTextLength,
    isValidDescription,
    isValidTag,
    isValidTags,
    isValidUUID,
    isValidUrl,
    isValidYandexId,
    sanitizeString,
    validateVideoUpload
  };
}

