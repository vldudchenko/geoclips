/**
 * Middleware для валидации данных
 */

const logger = require('../utils/logger');
const { isValidCoordinates } = require('../utils/geoUtils');

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

module.exports = {
  validateCoordinates,
  validateAccessToken,
  validateAddress,
  validateFile
};

