/**
 * Middleware для проверки авторизации
 */

const logger = require('../utils/logger');

/**
 * Проверка, что пользователь авторизован
 */
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
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

