/**
 * Сервис аутентификации
 * Централизованная логика для работы с Яндекс OAuth
 */

const axios = require('axios');
const logger = require('../utils/logger');
const { ensureUserInDatabase } = require('./userService');

/**
 * Получить информацию пользователя от Яндекс API по токену доступа
 * @param {string} accessToken - OAuth токен доступа Яндекса
 * @returns {Object} информация пользователя
 */
const getYandexUserInfo = async (accessToken) => {
  try {
    const response = await axios.get('https://login.yandex.ru/info', {
      headers: {
        'Authorization': `OAuth ${accessToken}`
      }
    });
    return response.data;
  } catch (error) {
    logger.error('AUTH', 'Ошибка получения информации от Яндекс API', error);
    throw error;
  }
};

/**
 * Создать объект пользователя для сессии на основе данных Яндекса
 * @param {Object} yandexUserInfo - информация пользователя от Яндекс API
 * @param {string} accessToken - OAuth токен доступа
 * @returns {Object} объект пользователя для сессии
 */
const createSessionUser = async (yandexUserInfo, accessToken) => {
  try {
    logger.info('AUTH', 'Создание объекта пользователя для сессии');

    // Сохраняем/обновляем пользователя в базе
    const dbUser = await ensureUserInDatabase(yandexUserInfo);

    const user = {
      id: yandexUserInfo.id,
      displayName: yandexUserInfo.display_name || yandexUserInfo.real_name || yandexUserInfo.login,
      photos: [{ value: `https://avatars.yandex.net/get-yapic/${yandexUserInfo.default_avatar_id}/islands-200` }],
      accessToken: accessToken,
      dbUser: dbUser
    };

    logger.success('AUTH', 'Объект пользователя создан');
    return user;
  } catch (error) {
    logger.error('AUTH', 'Ошибка создания объекта пользователя', error);
    throw error;
  }
};

/**
 * Аутентифицировать пользователя по Яндекс токену (для Bearer авторизации)
 * @param {string} accessToken - OAuth токен доступа
 * @returns {Object} объект пользователя
 */
const authenticateWithBearerToken = async (accessToken) => {
  try {
    logger.info('AUTH', 'Аутентификация с Bearer токеном');
    
    const yandexUserInfo = await getYandexUserInfo(accessToken);
    const user = await createSessionUser(yandexUserInfo, accessToken);
    
    logger.success('AUTH', 'Bearer аутентификация успешна');
    return user;
  } catch (error) {
    logger.error('AUTH', 'Ошибка Bearer аутентификации', error);
    throw error;
  }
};

module.exports = {
  getYandexUserInfo,
  createSessionUser,
  authenticateWithBearerToken
};
