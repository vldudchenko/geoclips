/**
 * Конфигурация Passport для OAuth аутентификации
 */

const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2').Strategy;
const config = require('./environment');
const logger = require('../utils/logger');
const { createSessionUser } = require('../services/authService');
const { getYandexUserInfo } = require('../services/authService');

/**
 * Настройка Yandex OAuth2 стратегии
 */
passport.use('yandex', new OAuth2Strategy({
  authorizationURL: 'https://oauth.yandex.ru/authorize',
  tokenURL: 'https://oauth.yandex.ru/token',
  clientID: config.yandex.clientId,
  clientSecret: config.yandex.clientSecret,
  callbackURL: `${config.baseUrl}/auth/yandex/callback`
  
}, async (accessToken, refreshToken, profile, done) => {
  try {
    logger.auth('Начало авторизации через Яндекс');

    // Получаем информацию о пользователе через API Яндекс
    const userInfo = await getYandexUserInfo(accessToken);
    
    logger.info('AUTH', 'Данные пользователя от Яндекс получены');

    // Создаем объект пользователя для сессии
    const user = await createSessionUser(userInfo, accessToken);

    logger.success('AUTH', 'OAuth аутентификация успешна (ожидание создания сессии)');
    return done(null, user);
  } catch (error) {
    logger.error('AUTH', 'Ошибка OAuth аутентификации', error);
    return done(error, null);
  }
}));

/**
 * Сериализация пользователя
 */
passport.serializeUser((user, done) => {
  done(null, user);
});

/**
 * Десериализация пользователя
 */
passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;

