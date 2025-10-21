/**
 * Middleware для проверки авторизации
 */

const logger = require('../utils/logger');
const axios = require('axios');
const config = require('../config/environment');
const { ensureUserInDatabase } = require('../services/userService');

/**
 * Проверка, что пользователь авторизован
 */
const requireAuth = async (req, res, next) => {
  try {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return next();
    }

    // Dev-путь: поддержка Bearer токена Яндекс для совместимости клиента
    const authHeader = req.get('authorization') || req.get('Authorization');
    const allowBearer = config.nodeEnv !== 'production' || config.features.allowProfileLookupByAccessToken;
    if (allowBearer && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring('Bearer '.length).trim();
      if (token) {
        try {
          const response = await axios.get('https://login.yandex.ru/info', {
            headers: { Authorization: `OAuth ${token}` }
          });
          const yandexUser = response.data;
          const dbUser = await ensureUserInDatabase(yandexUser);
          req.user = {
            id: yandexUser.id,
            displayName: yandexUser.display_name || yandexUser.real_name || yandexUser.login,
            photos: [{ value: `https://avatars.yandex.net/get-yapic/${yandexUser.default_avatar_id}/islands-200` }],
            accessToken: token,
            dbUser
          };
          return next();
        } catch (e) {
          logger.warn('AUTH', 'Неверный Bearer токен', { message: e.message });
        }
      }
    }

    logger.warn('AUTH', 'Попытка доступа без авторизации', {
      url: req.url,
      method: req.method,
      ip: req.ip
    });
    res.status(401).json({ 
      error: 'Требуется авторизация',
      code: 'UNAUTHORIZED'
    });
  } catch (error) {
    logger.error('AUTH', 'Ошибка в requireAuth', error);
    res.status(500).json({ error: 'Ошибка проверки авторизации' });
  }
};

/**
 * Опциональная авторизация (не требует обязательной авторизации)
 */
const optionalAuth = (req, res, next) => {
  // Просто продолжаем, даже если не авторизован
  next();
};

/**
 * Проверка, что пользователь является владельцем ресурса
 */
const requireOwnership = (resourceUserIdGetter) => {
  return async (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      logger.warn('AUTH', 'Попытка доступа к ресурсу без авторизации');
      return res.status(401).json({ 
        error: 'Требуется авторизация',
        code: 'UNAUTHORIZED'
      });
    }
    
    try {
      const resourceUserId = await resourceUserIdGetter(req);
      const currentUserId = req.user?.dbUser?.id;
      
      if (!currentUserId || resourceUserId !== currentUserId) {
        logger.warn('AUTH', 'Попытка доступа к чужому ресурсу', {
          currentUserId,
          resourceUserId
        });
        
        return res.status(403).json({ 
          error: 'Доступ запрещен',
          code: 'FORBIDDEN'
        });
      }
      
      next();
    } catch (error) {
      logger.error('AUTH', 'Ошибка проверки владельца ресурса', error);
      res.status(500).json({ 
        error: 'Ошибка проверки прав доступа',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Проверка роли администратора
 */
const requireAdmin = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    logger.warn('AUTH', 'Попытка доступа к админке без авторизации');
    return res.status(401).json({ 
      error: 'Требуется авторизация',
      code: 'UNAUTHORIZED'
    });
  }
  
  // Здесь можно добавить проверку роли из БД
  // const isAdmin = req.user?.dbUser?.role === 'admin';
  
  // Проверяем права администратора
  const config = require('../config/environment');
  const adminIds = config.admin.ids;
  const userId = req.user?.dbUser?.id;
  
  // Если ADMIN_IDS не задана, разрешаем доступ всем авторизованным пользователям
  if (adminIds.length > 0 && !adminIds.includes(userId)) {
    logger.warn('AUTH', 'Попытка доступа к админке без прав', { userId, adminIds });
    return res.status(403).json({ 
      error: 'Доступ запрещен', 
      code: 'FORBIDDEN' 
    });
  }
  
  next();
};

module.exports = {
  requireAuth,
  optionalAuth,
  requireOwnership,
  requireAdmin
};

