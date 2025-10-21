/**
 * Сервис для работы с API сервера
 * Централизованные запросы к серверу для оптимизации
 */

import CacheService from './cacheService';
import { SERVER_URL, ERROR_MESSAGES } from '../utils/constants';

/**
 * Обработка ответа от сервера
 */
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: ERROR_MESSAGES.SERVER_ERROR }));
    throw new Error(error.error || ERROR_MESSAGES.SERVER_ERROR);
  }
  return response.json();
};

export class ServerApi {
  /**
   * Генерация превью видео на сервере
   */
  static async generateVideoThumbnail(videoFile) {
    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await fetch(`${SERVER_URL}/api/video/generate-thumbnail`, {
        method: 'POST',
        body: formData,
      });

      return handleResponse(response);
    } catch (error) {
      console.error('ServerApi Error [generateVideoThumbnail]:', error);
      throw error;
    }
  }

  // Создание круглого аватара на сервере
  static async createAvatar(avatarFile) {
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);

      const response = await fetch(`${SERVER_URL}/api/create-avatar`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Ошибка создания аватара на сервере:', error);
      throw error;
    }
  }

  /**
   * Валидация видео на сервере
   */
  static async validateVideo(videoFile) {
    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await fetch(`${SERVER_URL}/api/video/validate-video`, {
        method: 'POST',
        body: formData,
      });

      return handleResponse(response);
    } catch (error) {
      console.error('ServerApi Error [validateVideo]:', error);
      throw error;
    }
  }

  /**
   * Получение данных пользователя Яндекс через сервер с кэшированием
   */
  static async getYandexUserData(accessToken, forceRefresh = false) {
    try {
      const userId = this.extractUserIdFromToken(accessToken);
      
      if (!forceRefresh && userId) {
        const cachedData = CacheService.getUserDataFromAnyCache(userId);
        if (cachedData) {
          return {
            success: true,
            userData: cachedData,
            fromCache: true
          };
        }
      }

      const response = await fetch(`${SERVER_URL}/api/yandex-user-data?accessToken=${encodeURIComponent(accessToken)}`);
      const result = await handleResponse(response);
      
      if (result.success && userId) {
        CacheService.updateUserData(userId, result.userData, true);
      }
      
      return result;
    } catch (error) {
      console.error('ServerApi Error [getYandexUserData]:', error);
      throw error;
    }
  }

  // Очистка кэша пользователя на сервере
  static async clearYandexUserCache(accessToken) {
    try {
      const response = await fetch(`${SERVER_URL}/api/yandex-user-cache?accessToken=${encodeURIComponent(accessToken)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Также очищаем клиентский кэш
      const userId = this.extractUserIdFromToken(accessToken);
      if (userId) {
        CacheService.clearUserData(true);
        CacheService.clearUserData(false);
      }
      
      return result;
    } catch (error) {
      console.error('Ошибка очистки кэша пользователя:', error);
      throw error;
    }
  }

  // Вспомогательная функция для извлечения userId из токена
  static extractUserIdFromToken(accessToken) {
    try {
      // Используем сам токен как ключ для кэширования
      // Это безопасно, так как токены уникальны для каждого пользователя
      return accessToken ? `token_${accessToken.substring(0, 20)}` : null;
    } catch (error) {
      console.error('Ошибка извлечения userId из токена:', error);
      return null;
    }
  }

  /**
   * Геокодирование через сервер
   */
  static async geocodeAddress(address) {
    try {
      const response = await fetch(`${SERVER_URL}/api/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });

      return handleResponse(response);
    } catch (error) {
      console.error('ServerApi Error [geocodeAddress]:', error);
      throw error;
    }
  }
}
