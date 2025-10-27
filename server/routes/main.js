/**
 * Основные роуты админ панели (главная страница, статика, тест)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { readFile, access } = require('fs').promises;
const logger = require('../utils/logger');
const { requireAdmin } = require('../middleware/unified');

/**
 * Главная страница админки
 */
router.get('/', requireAdmin, async (req, res) => {
  try {

    
    logger.info('ADMIN', 'Запрос к админке');
    
    // На этом этапе пользователь уже авторизован и имеет права администратора
    // (проверено в requireAdmin middleware)
    
    try {
      const htmlPath = path.join(__dirname, '../views/admin.html');
      logger.info('ADMIN', 'Загрузка админки');
      
      // Проверяем существование файла
      try {
        await access(htmlPath);
      } catch (accessError) {
        logger.error('ADMIN', 'Файл админки не найден', { htmlPath, error: accessError.message });
        throw new Error(`Файл админки не найден: ${htmlPath}`);
      }
      
      const html = await readFile(htmlPath, 'utf-8');
      res.send(html);
      logger.success('ADMIN', 'Админка загружена');
    } catch (fileError) {
      logger.error('ADMIN', 'Ошибка чтения файла админки', fileError);      
    }
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки админ панели', { 
      message: error.message, 
      stack: error.stack,
      userId: req.user?.dbUser?.id
    });
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Ошибка админки</h1>
          <p>Произошла ошибка при загрузке админ панели.</p>
          <p>Ошибка: ${error.message}</p>
          <a href="/admin">Попробовать снова</a>
        </body>
      </html>
    `);
  }
});

/**
 * CSS файл админки
 */
router.get('/admin.css', async (req, res) => {
  try {
    const cssPath = path.join(__dirname, '../views/admin.css');
    const css = await readFile(cssPath, 'utf-8');
    res.type('text/css').send(css);
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки CSS', error);
    res.status(500).send('/* Ошибка загрузки CSS */');
  }
});

/**
 * JS файл админки (объединенный)
 */
router.get('/admin-unified.js', async (req, res) => {
  try {
    const jsPath = path.join(__dirname, '../views/admin-unified.js');
    const js = await readFile(jsPath, 'utf-8');
    res.type('application/javascript').send(js);
  } catch (error) {
    logger.error('ADMIN', 'Ошибка загрузки JS', error);
    res.status(500).send('// Ошибка загрузки JS');
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

