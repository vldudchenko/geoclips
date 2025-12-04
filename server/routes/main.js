/**
 * Основные роуты админ панели
 * Теперь админка находится в клиентской части, этот роут только проверяет права и редиректит
 */

const express = require('express');
const router = express.Router();
const config = require('../config/environment');
const logger = require('../utils/logger');
const { requireAdmin, requireAuth } = require('../middleware/unified');

/**
 * Главная страница админки - редирект на клиентскую админку
 * Проверяет права администратора и редиректит на клиентскую админку
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    logger.info('ADMIN', 'Запрос к админке - редирект на клиентскую админку');
    
    // В production режиме отдаем SPA (index.html), клиент сам обработает роут /admin
    // В development режиме редиректим на клиентский сервер
    if (config.nodeEnv === 'production') {
      const path = require('path');
      const clientBuildPath = path.join(__dirname, '../../client/build');
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    } else {
      // В development режиме редиректим на клиентский сервер
      const clientUrl = config.clientUrl || 'http://localhost:3000';
      res.redirect(`${clientUrl}/admin`);
    }
  } catch (error) {
    logger.error('ADMIN', 'Ошибка редиректа на клиентскую админку', { 
      message: error.message, 
      stack: error.stack,
      userId: req.user?.dbUser?.id
    });
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Ошибка админки</h1>
          <p>Произошла ошибка при переходе в админ панель.</p>
          <p>Ошибка: ${error.message}</p>
          <a href="/">Вернуться на главную</a>
        </body>
      </html>
    `);
  }
});

/**
 * Проверка прав доступа к админке (для клиента)
 */
router.get('/check-access', requireAuth, (req, res) => {
  try {
    const adminIds = config.admin.ids;
    const userId = req.user?.dbUser?.id;
    
    // Если ADMIN_IDS не задана, разрешаем доступ всем авторизованным пользователям
    const hasAccess = adminIds.length === 0 || adminIds.includes(userId);
    
    res.json({ success: hasAccess });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка проверки прав доступа', error);
    res.status(500).json({ success: false, error: 'Ошибка проверки прав доступа' });
  }
});

/**
 * Тестовый маршрут для проверки API
 */
router.get('/test', async (req, res) => {
  try {
    logger.info('ADMIN', 'Тестовый запрос');
    res.json({ message: 'API работает!', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка тестового запроса', error);
    res.status(500).json({ error: 'Ошибка тестового запроса' });
  }
});

/**
 * Выход из админки
 */
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      logger.error('ADMIN', 'Ошибка при выходе', err);
      return res.status(500).json({ error: 'Ошибка при выходе' });
    }
    
    req.session.destroy((err) => {
      if (err) {
        logger.error('ADMIN', 'Ошибка при уничтожении сессии', err);
        return res.status(500).json({ error: 'Ошибка при выходе' });
      }
      
      res.clearCookie('connect.sid');
      res.json({ message: 'Успешный выход' });
    });
  });
});

module.exports = router;

