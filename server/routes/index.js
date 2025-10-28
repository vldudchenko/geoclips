/**
 * Главный роутер админ панели
 * Объединяет все модули для лучшей организации кода
 */

const express = require('express');
const router = express.Router();

// Импортируем модули
const mainRoutes = require('./main');
const usersRoutes = require('./users');
const videoRoutes = require('./video');
const tagsRoutes = require('./tags');
const commentsRoutes = require('./comments');
const likesRoutes = require('./likes');


// Подключаем модули
router.use('/', mainRoutes);           // Главная страница, статика, выход
router.use('/users', usersRoutes);     // /users, /users/search, /users/:id
router.use('/videos', videoRoutes);    // /videos (объединенные функции пользователей и админов)
router.use('/tags', tagsRoutes);       // /tags, /tags/:id, /tags/fix-counters, /tags/bulk
router.use('/comments', commentsRoutes); // /comments/admin/all (админские маршруты комментариев)
router.use('/likes', likesRoutes);     // /likes/given/:userId, /likes/received/:userId

module.exports = router;

