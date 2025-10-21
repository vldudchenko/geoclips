/**
 * Утилиты для работы с кэшированием
 */

const config = require('../config/environment');
const logger = require('./logger');

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = config.cache.ttl;
    
    // Очистка устаревших записей каждые 2 минуты
    setInterval(() => this.cleanExpiredCache(), 2 * 60 * 1000);
  }

  /**
   * Очистка устаревших записей кэша
   */
  cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.cache('CACHE', `Очищено устаревших записей: ${cleaned}`);
    }
  }

  /**
   * Установить значение в кэш
   */
  set(key, data, ttl = this.cacheTTL) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl
    });
    logger.cache('CACHE', `Данные сохранены в кэш: ${key}`);
  }

  /**
   * Получить значение из кэша
   */
  get(key) {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    // Проверяем актуальность
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      logger.cache('CACHE', `Кэш устарел: ${key}`);
      return null;
    }
    
    logger.cache('CACHE', `Данные получены из кэша: ${key}`);
    return cached.data;
  }

  /**
   * Удалить значение из кэша
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.cache('CACHE', `Удалено из кэша: ${key}`);
    }
    return deleted;
  }

  /**
   * Очистить весь кэш
   */
  clear() {
    this.cache.clear();
    logger.cache('CACHE', 'Весь кэш очищен');
  }

  /**
   * Получить размер кэша
   */
  size() {
    return this.cache.size;
  }

  /**
   * Проверить наличие ключа в кэше
   */
  has(key) {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    // Проверяем актуальность
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
}

module.exports = new CacheManager();

