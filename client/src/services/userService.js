import CacheService from './cacheService';
import { SERVER_URL } from '../utils/constants';

/**
 * Сервис для работы с пользователями
 * Все запросы проходят через сервер для безопасности
 */
export class UserService {
  /**
   * Обработка ошибок
   */
  static handleError(error, context = '') {
    console.error(`UserService Error [${context}]:`, error);
    
    if (error.message?.includes('404') || error.message?.includes('не найден')) {
      throw new Error('Пользователь не найден');
    }
    if (error.message?.includes('401') || error.message?.includes('авторизации')) {
      throw new Error('Ошибка авторизации');
    }
    
    throw error;
  }

  /**
   * Выполнение запроса к серверу
   */
  static async fetchFromServer(endpoint, options = {}) {
    try {
      const response = await fetch(`${SERVER_URL || ''}/api${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }
  /**
   * Создать или обновить пользователя
   * ВАЖНО: Эта функция должна вызываться только через сервер при авторизации
   * Для клиента доступна только через серверный API
   */
  static async createOrUpdateUser(userData) {
    try {
      // Эта операция должна выполняться на сервере при авторизации
      // Для клиента используем синхронизацию через сервер
      const result = await this.fetchFromServer('/update-user-data', {
        method: 'POST',
        body: JSON.stringify({ userData })
      });

      if (result.user) {
        const data = result.user;
        // Обновляем кэш
        CacheService.setUserData(`yandex_${userData.yandex_id}`, data, true);
        CacheService.setUserData(`user_${data.id}`, data, true);
        return data;
      }

      return null;
    } catch (error) {
      this.handleError(error, 'createOrUpdateUser');
    }
  }

  /**
   * Получить пользователя по Yandex ID с кэшированием
   */
  static async getUserByYandexId(yandexId, useCache = true) {
    try {
      if (useCache) {
        const cachedUser = CacheService.getUserData(`yandex_${yandexId}`, true);
        if (cachedUser) return cachedUser;
      }

      const result = await this.fetchFromServer(`/users/by-yandex-id/${yandexId}`);
      
      if (result.success && result.user) {
        const data = result.user;
        if (useCache) {
          CacheService.setUserData(`yandex_${yandexId}`, data, true);
        }
        return data;
      }
      
      return null;
    } catch (error) {
      this.handleError(error, 'getUserByYandexId');
    }
  }

  /**
   * Получить пользователя по ID с кэшированием
   */
  static async getUserById(userId, useCache = true) {
    try {
      if (useCache) {
        const cachedUser = CacheService.getUserData(`user_${userId}`, true);
        if (cachedUser) return cachedUser;
      }

      const result = await this.fetchFromServer(`/users/${userId}`);
      
      if (result.success && result.user) {
        const data = result.user;
        if (useCache) {
          CacheService.setUserData(`user_${userId}`, data, true);
        }
        return data;
      }
      
      return null;
    } catch (error) {
      this.handleError(error, 'getUserById');
    }
  }

  /**
   * Получить пользователя по display_name с кэшированием
   */
  static async getUserByDisplayName(displayName, useCache = true) {
    try {
      console.log('🔍 UserService.getUserByDisplayName: ищем пользователя по display_name:', displayName);
      
      if (useCache) {
        const cachedUser = CacheService.getUserData(`display_name_${displayName}`, true);
        if (cachedUser) {
          console.log('✅ UserService.getUserByDisplayName: найден в кэше:', cachedUser);
          return cachedUser;
        }
      }

      const result = await this.fetchFromServer(`/users/by-display-name/${encodeURIComponent(displayName)}`);
      
      if (result.success && result.user) {
        const data = result.user;
        if (useCache) {
          CacheService.setUserData(`display_name_${displayName}`, data, true);
        }
        console.log('✅ UserService.getUserByDisplayName: результат поиска:', data);
        return data;
      }
      
      console.log('❌ UserService.getUserByDisplayName: пользователь не найден');
      return null;
    } catch (error) {
      console.error('❌ UserService.getUserByDisplayName: общая ошибка:', error);
      this.handleError(error, 'getUserByDisplayName');
    }
  }

  // Обновить профиль пользователя с инвалидацией кэша
  // ВАЖНО: Эта операция должна выполняться через серверный API
  static async updateUserProfile(userId, profileData) {
    try {
      const result = await this.fetchFromServer(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });

      if (result.success && result.user) {
        const data = result.user;
        // Инвалидируем кэш после обновления
        CacheService.clearUserData(`user_${userId}`, true);
        if (data.yandex_id) {
          CacheService.clearUserData(`yandex_${data.yandex_id}`, true);
        }
        
        // Обновляем кэш новыми данными
        CacheService.setUserData(`user_${userId}`, data, true);
        if (data.yandex_id) {
          CacheService.setUserData(`yandex_${data.yandex_id}`, data, true);
        }
        
        return data;
      }
      
      throw new Error('Ошибка обновления профиля');
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  // Получить видео пользователя
  static async getUserVideos(userId) {
    try {
      console.log('🔍 UserService.getUserVideos: ищем видео для userId:', userId);
      
      const result = await this.fetchFromServer(`/profile/${userId}`);
      
      if (result.success && result.videos) {
        console.log('✅ UserService.getUserVideos: найдено видео:', result.videos.length);
        return result.videos;
      }
      
      return [];
    } catch (error) {
      console.error('❌ UserService.getUserVideos: общая ошибка:', error);
      throw error;
    }
  }

  // Синхронизировать данные пользователя с Яндекс с кэшированием
  // ВАЖНО: avatar_url НЕ формируется здесь, он должен обновляться через сервер
  static async syncUserWithYandex(yandexUserData, forceRefresh = false) {
    try {
      // Проверяем кэш перед синхронизацией, если не принудительное обновление
      if (!forceRefresh) {
        const cachedUser = CacheService.getUserData(`yandex_${yandexUserData.id}`, true);
        if (cachedUser) {
          return cachedUser;
        }
      }

      const userData = {
        yandex_id: yandexUserData.id,
        first_name: yandexUserData.first_name,
        last_name: yandexUserData.last_name,
        display_name: yandexUserData.display_name || yandexUserData.real_name,
        // НЕ формируем avatar_url здесь - он обновляется на сервере через avatarService
        // Если есть avatar_url из БД, используем его
        avatar_url: yandexUserData.avatar_url || null
      };

      const result = await this.createOrUpdateUser(userData);
      
      // Кэшируем результат синхронизации
      if (result) {
        CacheService.setUserData(`yandex_${userData.yandex_id}`, result, true);
        CacheService.setUserData(`user_${result.id}`, result, true);
      }
      
      return result;
    } catch (error) {
      console.error('Error syncing user with Yandex:', error);
      throw error;
    }
  }

  // Принудительно обновить кэш пользователя
  static async refreshUserCache(userId, yandexId = null) {
    try {
      // Очищаем существующий кэш
      CacheService.clearUserData(`user_${userId}`, true);
      if (yandexId) {
        CacheService.clearUserData(`yandex_${yandexId}`, true);
      }
      
      // Загружаем свежие данные из базы
      const freshData = await this.getUserById(userId, false);
      
      if (freshData) {
        // Кэшируем свежие данные
        CacheService.setUserData(`user_${userId}`, freshData, true);
        if (freshData.yandex_id) {
          CacheService.setUserData(`yandex_${freshData.yandex_id}`, freshData, true);
        }
      }
      
      return freshData;
    } catch (error) {
      console.error('Error refreshing user cache:', error);
      throw error;
    }
  }

  // Очистить весь кэш пользователей
  static clearAllUserCache() {
    CacheService.clearAllCache();
  }
}
