/**
 * Главный роутер админ панели
 * Объединяет все модули для лучшей организации кода
 */

const express = require('express');
const router = express.Router();

// Импортируем модули
const mainRoutes = require('./main');
const statsRoutes = require('./stats');
const usersRoutes = require('./users');
const videoRoutes = require('./video');
const tagsRoutes = require('./tags');
const systemRoutes = require('./system');

// Подключаем модули
router.use('/', mainRoutes);           // Главная страница, статика, выход
router.use('/', statsRoutes);          // /stats, /analytics, /activity-logs
router.use('/users', usersRoutes);     // /users, /users/search, /users/:id
router.use('/videos', videoRoutes);    // /videos (объединенные функции пользователей и админов)
router.use('/tags', tagsRoutes);       // /tags, /tags/:id, /tags/fix-counters, /tags/bulk
router.use('/system', systemRoutes);   // /system/info, /system/export/:type, /system/cleanup

module.exports = router;

