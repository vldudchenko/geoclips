import { supabase } from '../lib/supabase';
import CacheService from './cacheService';

/**
 * Сервис для работы с пользователями
 * Оптимизированная версия с улучшенным кэшированием
 */
export class UserService {
  /**
   * Обработка ошибок Supabase
   */
  static handleError(error, context = '') {
    console.error(`UserService Error [${context}]:`, error);
    
    if (error.code === 'PGRST116') {
      throw new Error('Пользователь не найден');
    }
    if (error.message?.includes('JWT')) {
      throw new Error('Ошибка авторизации');
    }
    
    throw error;
  }
  /**
   * Создать или обновить пользователя
   */
  static async createOrUpdateUser(userData) {
    try {
      const existingUser = await this.getUserByYandexId(userData.yandex_id, false);
      
      if (existingUser) {
        const { data, error } = await supabase
          .from('users')
          .update(() => {
            const updatePayload = {
              first_name: userData.first_name,
              last_name: userData.last_name,
              display_name: userData.display_name,
              updated_at: new Date().toISOString()
            };
            // Не трогаем avatar_url, если явное значение не передано
            if (typeof userData.avatar_url !== 'undefined') {
              updatePayload.avatar_url = userData.avatar_url;
            }
            return updatePayload;
          })
          .eq('yandex_id', userData.yandex_id)
          .select('id, yandex_id, display_name, avatar_url, first_name, last_name, created_at, updated_at')
          .maybeSingle();

        if (error) this.handleError(error, 'updateUser');
        
        // Обновляем кэш
        if (data) {
          CacheService.setUserData(`yandex_${userData.yandex_id}`, data, true);
          CacheService.setUserData(`user_${data.id}`, data, true);
        }
        
        return data;
      } else {
        const { data, error } = await supabase
          .from('users')
          .insert([{
            ...userData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select('id, yandex_id, display_name, avatar_url, first_name, last_name, created_at, updated_at')
          .maybeSingle();

        if (error) this.handleError(error, 'createUser');
        
        // Сохраняем в кэш
        if (data) {
          CacheService.setUserData(`yandex_${userData.yandex_id}`, data, true);
          CacheService.setUserData(`user_${data.id}`, data, true);
        }
        
        return data;
      }
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

      const { data, error } = await supabase
        .from('users')
        .select('id, yandex_id, display_name, avatar_url, first_name, last_name, created_at, updated_at')
        .eq('yandex_id', yandexId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        this.handleError(error, 'getUserByYandexId');
      }
      
      if (data && useCache) {
        CacheService.setUserData(`yandex_${yandexId}`, data, true);
      }
      
      return data;
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

      const { data, error } = await supabase
        .from('users')
        .select('id, yandex_id, display_name, avatar_url, first_name, last_name, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        this.handleError(error, 'getUserById');
      }
      
      if (data && useCache) {
        CacheService.setUserData(`user_${userId}`, data, true);
      }
      
      return data;
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

      const { data, error } = await supabase
        .from('users')
        .select('id, yandex_id, display_name, avatar_url, first_name, last_name, created_at, updated_at, display_name')
        .eq('display_name', displayName)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ UserService.getUserByDisplayName: ошибка Supabase:', error);
        this.handleError(error, 'getUserByDisplayName');
      }

      if (data && useCache) {
        CacheService.setUserData(`display_name_${displayName}`, data, true);
      }

      console.log('✅ UserService.getUserByDisplayName: результат поиска:', data);
      return data;
    } catch (error) {
      console.error('❌ UserService.getUserByDisplayName: общая ошибка:', error);
      this.handleError(error, 'getUserByDisplayName');
    }
  }

  // Обновить профиль пользователя с инвалидацией кэша
  static async updateUserProfile(userId, profileData) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(profileData)
        .eq('id', userId)
        .select('id, yandex_id, display_name, avatar_url, first_name, last_name, created_at, updated_at')
        .maybeSingle(); // Используем maybeSingle вместо single

      if (error) throw error;
      
      // Инвалидируем кэш после обновления
      if (data) {
        CacheService.clearUserData(`user_${userId}`, true);
        CacheService.clearUserData(`yandex_${data.yandex_id}`, true);
        
        // Обновляем кэш новыми данными
        CacheService.setUserData(`user_${userId}`, data, true);
        CacheService.setUserData(`yandex_${data.yandex_id}`, data, true);
      }
      
      return data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  // Получить видео пользователя
  static async getUserVideos(userId) {
    try {
      console.log('🔍 UserService.getUserVideos: ищем видео для userId:', userId);
      const { data, error } = await supabase
        .from('videos')
        .select(`
          id,
          user_id,
          description,
          video_url,
          latitude,
          longitude,
          likes_count,
          views_count,
          created_at,
          updated_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ UserService.getUserVideos: ошибка Supabase:', error);
        throw error;
      }
      
      console.log('✅ UserService.getUserVideos: найдено видео:', data?.length || 0, data);
      return data;
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
