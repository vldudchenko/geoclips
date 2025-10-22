/**
 * Роуты для аутентификации через Yandex OAuth
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { readFile } = require('fs').promises;
const passport = require('passport');
const supabase = require('../config/supabase');
const config = require('../config/environment');
const logger = require('../utils/logger');

/**
 * Страница входа
 */
router.get('/login', async (req, res) => {
  try {
    const loginPath = path.join(__dirname, '../views/login.html');
    const html = await readFile(loginPath, 'utf-8');
    res.type('text/html').send(html);
  } catch (error) {
    logger.error('AUTH', 'Ошибка загрузки страницы входа', error);
    res.status(500).json({ error: 'Ошибка загрузки страницы входа' });
  }
});

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
  // Сохраняем ожидаемый маршрут возврата (если вдруг потерялся при редиректе)
  const intendedReturnTo = (req.session?.returnTo || req.query?.returnTo || '').toString();
  passport.authenticate('yandex', async (err, user, info) => {
    try {
      if (err) {
        // Частый кейс: повторный запрос с тем же code => "Code has expired"
        logger.warn('AUTH', 'OAuth callback error', { message: err.message, url: req.originalUrl });
        // При ошибке возвращаемся на админку только если логин инициирован из админки
        if (intendedReturnTo.includes('/admin')) {
          return res.redirect(`${(config.baseUrl || '').trim().replace(/\/+$/, '')}/admin`);
        }
        return res.redirect(`${(config.clientUrl || '').trim().replace(/\/+$/, '')}/profile/current`);
      }
      if (!user) {
        if (intendedReturnTo.includes('/admin')) {
          return res.redirect(`${(config.baseUrl || '').trim().replace(/\/+$/, '')}/admin`);
        }
        return res.redirect(`${(config.clientUrl || '').trim().replace(/\/+$/, '')}/profile/current`);
      }

      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          logger.error('AUTH', 'Ошибка сохранения сессии', loginErr);
          if (intendedReturnTo.includes('/admin')) {
            return res.redirect(`${(config.baseUrl || '').trim().replace(/\/+$/, '')}/admin`);
          }
          return res.redirect(`${(config.clientUrl || '').trim().replace(/\/+$/, '')}/profile/current`);
        }

        logger.success('AUTH', 'Сессия пользователя создана');

        const returnTo = req.session.returnTo || intendedReturnTo || '/';
        delete req.session.returnTo;

        if (returnTo === '/admin' || returnTo.includes('/admin')) {
          logger.info('AUTH', 'Перенаправление в панель администратора');
          req.session.save((saveErr) => {
            if (saveErr) {
              logger.error('AUTH', 'Ошибка сохранения сессии', saveErr);
            }
            res.redirect(`${(config.baseUrl || '').trim().replace(/\/+$/, '')}/admin`);
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
          return res.redirect(`${(config.clientUrl || '').trim().replace(/\/+$/, '')}/profile/current`);
        }

        if (dbUser?.display_name) {
          return res.redirect(`${(config.clientUrl || '').trim().replace(/\/+$/, '')}/profile/${dbUser.display_name}`);
        }
        return res.redirect(`${(config.clientUrl || '').trim().replace(/\/+$/, '')}/profile/current`);
      });
    } catch (e) {
      logger.error('AUTH', 'Ошибка в callback авторизации', e);
      if (intendedReturnTo.includes('/admin')) {
        return res.redirect(`${(config.baseUrl || '').trim().replace(/\/+$/, '')}/admin`);
      }
      return res.redirect(`${(config.clientUrl || '').trim().replace(/\/+$/, '')}/profile/current`);
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

