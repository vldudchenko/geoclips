/**
 * Конфигурация Passport для OAuth аутентификации
 */

const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2').Strategy;
const axios = require('axios');
const config = require('./environment');
const logger = require('../utils/logger');
const { ensureUserInDatabase } = require('../services/userService');

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
    const userResponse = await axios.get('https://login.yandex.ru/info', {
      headers: {
        'Authorization': `OAuth ${accessToken}`
      }
    });

    const userInfo = userResponse.data;
    
    logger.info('AUTH', 'Данные пользователя от Яндекс получены', {
      id: userInfo.id,
      display_name: userInfo.display_name,
      has_avatar: !userInfo.is_avatar_empty
    });

    // Сохраняем/обновляем пользователя в базе
    const dbUser = await ensureUserInDatabase(userInfo);

    // Создаем объект пользователя
    const user = {
      id: userInfo.id,
      displayName: userInfo.display_name || userInfo.real_name || userInfo.login,
      photos: [{ value: `https://avatars.yandex.net/get-yapic/${userInfo.default_avatar_id}/islands-200` }],
      accessToken: accessToken,
      dbUser: dbUser
    };

    logger.success('AUTH', 'Авторизация успешна', { user_id: user.id });
    return done(null, user);
  } catch (error) {
    logger.error('AUTH', 'Ошибка авторизации', error);
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

