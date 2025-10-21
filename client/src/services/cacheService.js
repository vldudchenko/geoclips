/**
 * Сервис для кэширования данных пользователя
 * Использует localStorage для персистентного хранения и sessionStorage для временного
 */

class CacheService {
  constructor() {
    this.CACHE_PREFIX = 'geoclips_cache_';
    this.USER_DATA_KEY = `${this.CACHE_PREFIX}user_data`;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 минут
  }

  /**
   * Сохранить данные пользователя в кэш
   * @param {string} userId - ID пользователя
   * @param {Object} userData - Данные пользователя
   * @param {boolean} persistent - Сохранить в localStorage (true) или sessionStorage (false)
   */
  setUserData(userId, userData, persistent = true) {
    try {
      const cacheData = {
        data: userData,
        timestamp: Date.now(),
        userId: userId
      };

      const storage = persistent ? localStorage : sessionStorage;
      storage.setItem(this.USER_DATA_KEY, JSON.stringify(cacheData));
      
      console.log('Данные пользователя сохранены в кэш:', persistent ? 'localStorage' : 'sessionStorage');
      return true;
    } catch (error) {
      console.error('Ошибка сохранения данных в кэш:', error);
      return false;
    }
  }

  /**
   * Получить данные пользователя из кэша
   * @param {string} userId - ID пользователя
   * @param {boolean} persistent - Искать в localStorage (true) или sessionStorage (false)
   * @returns {Object|null} Данные пользователя или null если не найдены/устарели
   */
  getUserData(userId, persistent = true) {
    try {
      const storage = persistent ? localStorage : sessionStorage;
      const cachedData = storage.getItem(this.USER_DATA_KEY);
      
      if (!cachedData) {
        return null;
      }

      const parsedData = JSON.parse(cachedData);
      
      // Проверяем, что данные не устарели и принадлежат нужному пользователю
      const isExpired = Date.now() - parsedData.timestamp > this.CACHE_TTL;
      const isCorrectUser = parsedData.userId === userId;
      
      if (isExpired || !isCorrectUser) {
        this.clearUserData(persistent);
        return null;
      }

      console.log('Данные пользователя получены из кэша:', persistent ? 'localStorage' : 'sessionStorage');
      return parsedData.data;
    } catch (error) {
      console.error('Ошибка получения данных из кэша:', error);
      this.clearUserData(persistent);
      return null;
    }
  }

  /**
   * Очистить кэш данных пользователя
   * @param {boolean} persistent - Очистить localStorage (true) или sessionStorage (false)
   */
  clearUserData(persistent = true) {
    try {
      const storage = persistent ? localStorage : sessionStorage;
      storage.removeItem(this.USER_DATA_KEY);
      console.log('Кэш данных пользователя очищен:', persistent ? 'localStorage' : 'sessionStorage');
    } catch (error) {
      console.error('Ошибка очистки кэша:', error);
    }
  }

  /**
   * Очистить весь кэш приложения
   */
  clearAllCache() {
    try {
      // Очищаем localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });

      // Очищаем sessionStorage
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      });

      console.log('Весь кэш приложения очищен');
    } catch (error) {
      console.error('Ошибка очистки всего кэша:', error);
    }
  }

  /**
   * Проверить, есть ли актуальные данные в кэше
   * @param {string} userId - ID пользователя
   * @returns {boolean} true если есть актуальные данные
   */
  hasValidCache(userId) {
    const persistentData = this.getUserData(userId, true);
    const sessionData = this.getUserData(userId, false);
    
    return !!(persistentData || sessionData);
  }

  /**
   * Получить данные из любого доступного кэша
   * @param {string} userId - ID пользователя
   * @returns {Object|null} Данные пользователя или null
   */
  getUserDataFromAnyCache(userId) {
    // Сначала проверяем sessionStorage (более свежие данные)
    let userData = this.getUserData(userId, false);
    
    // Если нет в sessionStorage, проверяем localStorage
    if (!userData) {
      userData = this.getUserData(userId, true);
    }
    
    return userData;
  }

  /**
   * Обновить данные пользователя в кэше
   * @param {string} userId - ID пользователя
   * @param {Object} userData - Новые данные пользователя
   * @param {boolean} persistent - Сохранить в localStorage (true) или sessionStorage (false)
   */
  updateUserData(userId, userData, persistent = true) {
    // Обновляем в указанном хранилище
    this.setUserData(userId, userData, persistent);
    
    // Также обновляем в sessionStorage для быстрого доступа
    if (persistent) {
      this.setUserData(userId, userData, false);
    }
  }
}

export default new CacheService();
