/**
 * Роуты для аутентификации через Yandex OAuth
 */

const express = require('express');
const router = express.Router();
const passport = require('passport');
const supabase = require('../config/supabase');
const config = require('../config/environment');
const logger = require('../utils/logger');

/**
 * Начало OAuth авторизации через Яндекс
 */
router.get('/yandex', (req, res, next) => {
  // Сохраняем URL возврата в сессии
  const returnTo = req.query.returnTo || '/';
  req.session.returnTo = returnTo;
  
  passport.authenticate('yandex')(req, res, next);
});

/**
 * Callback после авторизации через Яндекс
 */
router.get('/yandex/callback',
  passport.authenticate('yandex', { failureRedirect: `${config.clientUrl}/login` }),
  async (req, res) => {
    try {
      logger.success('AUTH', 'Успешная авторизация', { 
        user_id: req.user?.id,
        sessionId: req.sessionID,
        returnTo: req.session.returnTo
      });
      
      // Получаем URL возврата из сессии
      const returnTo = req.session.returnTo || '/';
      delete req.session.returnTo; // Очищаем после использования
      
      logger.info('AUTH', 'Callback redirect logic', { 
        returnTo, 
        baseUrl: config.baseUrl,
        clientUrl: config.clientUrl 
      });
      
      // Если это админка, перенаправляем туда
      if (returnTo === '/admin' || returnTo.includes('/admin')) {
        logger.info('AUTH', 'Redirecting to admin panel');
        // Принудительно сохраняем сессию перед редиректом
        req.session.save((err) => {
          if (err) {
            logger.error('AUTH', 'Ошибка сохранения сессии', err);
          }
          res.redirect(`${config.baseUrl}/admin`);
        });
        return;
      }
      
      // Получаем данные пользователя из базы данных
      const { data: dbUser, error } = await supabase
        .from('users')
        .select('id, display_name')
        .eq('yandex_id', req.user.id)
        .maybeSingle();

      if (error) {
        logger.error('AUTH', 'Ошибка получения данных пользователя из БД', error);
        // Fallback на токен доступа
        res.redirect(`${config.clientUrl}/profile/${req.user.accessToken}`);
        return;
      }

      if (dbUser?.display_name) {
        // Перенаправляем на страницу профиля с display_name пользователя
        res.redirect(`${config.clientUrl}/profile/${dbUser.display_name}`);
      } else {
        // Fallback на токен доступа если display_name не найден
        res.redirect(`${config.clientUrl}/profile/${req.user.accessToken}`);
      }
    } catch (error) {
      logger.error('AUTH', 'Ошибка в callback авторизации', error);
      // Fallback на токен доступа
      res.redirect(`${config.clientUrl}/profile/${req.user.accessToken}`);
    }
  }
);

/**
 * Проверка статуса авторизации
 */
router.get('/me', async (req, res) => {
  try {
    if (req.user) {
      // Получаем актуальные данные пользователя из БД
      const { data: dbUser, error } = await supabase
        .from('users')
        .select('id, yandex_id, first_name, last_name, display_name, avatar_url')
        .eq('yandex_id', req.user.id)
        .maybeSingle();

      if (error) {
        logger.error('AUTH', 'Ошибка получения данных пользователя из БД', error);
        return res.json({
          isAuthenticated: true,
          user: {
            id: req.user.id,
            displayName: req.user.displayName,
            photos: req.user.photos,
            accessToken: req.user.accessToken,
            dbUser: req.user.dbUser
          }
        });
      }

      // Возвращаем данные пользователя с токеном доступа
      res.json({
        isAuthenticated: true,
        user: {
          id: req.user.id,
          displayName: req.user.displayName,
          photos: req.user.photos,
          accessToken: req.user.accessToken,
          dbUser: dbUser
        }
      });
    } else {
      res.json({ isAuthenticated: false });
    }
  } catch (error) {
    logger.error('AUTH', 'Ошибка в /auth/me', error);
    res.status(500).json({ error: 'Ошибка получения данных пользователя' });
  }
});

/**
 * Выход из системы
 */
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      logger.error('AUTH', 'Ошибка при выходе', err);
      return res.status(500).json({ error: 'Ошибка при выходе' });
    }
    logger.success('AUTH', 'Пользователь вышел из системы');
    res.json({ success: true });
  });
});

module.exports = router;

