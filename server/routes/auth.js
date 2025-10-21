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
 * Callback после авторизации через Яндекс (c кастомной обработкой ошибок)
 */
router.get('/yandex/callback', (req, res, next) => {
  passport.authenticate('yandex', async (err, user, info) => {
    try {
      if (err) {
        // Частый кейс: повторный запрос с тем же code => "Code has expired"
        logger.warn('AUTH', 'OAuth callback error', { message: err.message, url: req.originalUrl });
        return res.redirect(`${config.baseUrl}/admin`);
      }
      if (!user) {
        return res.redirect(`${config.baseUrl}/admin`);
      }

      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          logger.error('AUTH', 'Ошибка сохранения сессии', loginErr);
          return res.redirect(`${config.baseUrl}/admin`);
        }

        logger.success('AUTH', 'Успешная авторизация', { 
          user_id: req.user?.id,
          sessionId: req.sessionID,
          returnTo: req.session.returnTo
        });

        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;

        logger.info('AUTH', 'Callback redirect logic', { 
          returnTo, 
          baseUrl: config.baseUrl,
          clientUrl: config.clientUrl 
        });

        if (returnTo === '/admin' || returnTo.includes('/admin')) {
          logger.info('AUTH', 'Redirecting to admin panel');
          req.session.save((saveErr) => {
            if (saveErr) {
              logger.error('AUTH', 'Ошибка сохранения сессии', saveErr);
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
          // Fallback на безопасный маршрут
          return res.redirect(`${config.clientUrl}/profile/current`);
        }

        if (dbUser?.display_name) {
          return res.redirect(`${config.clientUrl}/profile/${dbUser.display_name}`);
        }
        return res.redirect(`${config.clientUrl}/profile/current`);
      });
    } catch (e) {
      logger.error('AUTH', 'Ошибка в callback авторизации', e);
      return res.redirect(`${config.baseUrl}/admin`);
    }
  })(req, res, next);
});

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

/**
 * Выход (GET) для удобного разлогина из ссылок/кнопок
 */
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      logger.error('AUTH', 'Ошибка при выходе (GET)', err);
      return res.status(500).json({ error: 'Ошибка при выходе' });
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        logger.error('AUTH', 'Ошибка уничтожения сессии (GET)', destroyErr);
        return res.status(500).json({ error: 'Ошибка при выходе' });
      }
      res.clearCookie('connect.sid');
      // Возвращаем на админку, где будет показана кнопка входа
      res.redirect('/admin');
    });
  });
});

module.exports = router;

