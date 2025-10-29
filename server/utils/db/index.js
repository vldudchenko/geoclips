/**
 * Централизованный экспорт всех функций для работы с БД
 * Обратная совместимость с dbUtils.js
 */

const shared = require('./shared');
const users = require('./users');
const comments = require('./comments');
const likes = require('./likes');
const tags = require('./tags');
const views = require('./views');
const videos = require('./videos');

// Экспортируем все функции для обратной совместимости
module.exports = {
  // Shared utilities
  ...shared,
  
  // Users
  ...users,
  
  // Comments
  ...comments,
  
  // Likes
  ...likes,
  
  // Tags
  ...tags,
  
  // Views
  ...views,
  
  // Videos
  ...videos
};

