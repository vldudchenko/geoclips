// Пример использования системы кэширования Yandex ID

import { ServerApi } from './services/serverApi';
import { UserService } from './services/userService';
import CacheService from './services/cacheService';

// Пример 1: Получение данных пользователя с кэшированием
async function getUserDataExample(accessToken) {
  try {
    console.log('Запрашиваем данные пользователя...');
    
    // Первый запрос - данные загружаются с сервера
    const result1 = await ServerApi.getYandexUserData(accessToken);
    console.log('Результат 1:', result1.fromCache ? 'из кэша' : 'с сервера');
    
    // Второй запрос - данные возвращаются из кэша
    const result2 = await ServerApi.getYandexUserData(accessToken);
    console.log('Результат 2:', result2.fromCache ? 'из кэша' : 'с сервера');
    
    return result2.userData;
  } catch (error) {
    console.error('Ошибка получения данных:', error);
    throw error;
  }
}

// Пример 2: Принудительное обновление кэша
async function refreshUserDataExample(accessToken) {
  try {
    console.log('Принудительно обновляем данные...');
    
    // Принудительное обновление - игнорирует кэш
    const freshData = await ServerApi.getYandexUserData(accessToken, true);
    console.log('Свежие данные получены:', freshData.fromCache ? 'из кэша' : 'с сервера');
    
    return freshData.userData;
  } catch (error) {
    console.error('Ошибка обновления данных:', error);
    throw error;
  }
}

// Пример 3: Работа с UserService и кэшированием
async function userServiceExample(yandexId, userId) {
  try {
    console.log('Работа с UserService...');
    
    // Получение пользователя по Yandex ID (с кэшированием)
    const userByYandex = await UserService.getUserByYandexId(yandexId);
    console.log('Пользователь по Yandex ID:', userByYandex);
    
    // Получение пользователя по ID (с кэшированием)
    const userById = await UserService.getUserById(userId);
    console.log('Пользователь по ID:', userById);
    
    // Обновление профиля (автоматическая инвалидация кэша)
    const updatedUser = await UserService.updateUserProfile(userId, {
      display_name: 'Новое имя'
    });
    console.log('Профиль обновлен:', updatedUser);
    
    return updatedUser;
  } catch (error) {
    console.error('Ошибка работы с UserService:', error);
    throw error;
  }
}

// Пример 4: Управление кэшем
function cacheManagementExample() {
  console.log('Управление кэшем...');
  
  // Проверка наличия актуального кэша
  const hasCache = CacheService.hasValidCache('user_123');
  console.log('Есть актуальный кэш:', hasCache);
  
  // Получение данных из любого доступного кэша
  const cachedData = CacheService.getUserDataFromAnyCache('user_123');
  console.log('Данные из кэша:', cachedData);
  
  // Очистка кэша конкретного пользователя
  CacheService.clearUserData('user_123', true);
  console.log('Кэш пользователя очищен');
  
  // Очистка всего кэша
  CacheService.clearAllCache();
  console.log('Весь кэш очищен');
}

// Пример 5: Обработка ошибок и fallback
async function errorHandlingExample(accessToken) {
  try {
    // Попытка получить данные из кэша
    const userId = ServerApi.extractUserIdFromToken(accessToken);
    const cachedData = CacheService.getUserDataFromAnyCache(userId);
    
    if (cachedData) {
      console.log('Используем данные из кэша');
      return cachedData;
    }
    
    // Если кэша нет, запрашиваем с сервера
    console.log('Кэш пуст, запрашиваем с сервера');
    const serverData = await ServerApi.getYandexUserData(accessToken);
    
    if (serverData.success) {
      // Сохраняем в кэш для будущих запросов
      CacheService.setUserData(userId, serverData.userData, true);
      return serverData.userData;
    }
    
    throw new Error('Не удалось получить данные пользователя');
    
  } catch (error) {
    console.error('Ошибка получения данных:', error);
    
    // Fallback - возвращаем базовые данные
    return {
      id: 'unknown',
      firstName: 'Пользователь',
      lastName: '',
      displayName: 'Пользователь',
      avatar: null
    };
  }
}

// Пример 6: Мониторинг производительности
async function performanceMonitoringExample(accessToken) {
  const startTime = performance.now();
  
  try {
    const result = await ServerApi.getYandexUserData(accessToken);
    const endTime = performance.now();
    
    const metrics = {
      responseTime: endTime - startTime,
      fromCache: result.fromCache,
      timestamp: new Date().toISOString()
    };
    
    console.log('Метрики производительности:', metrics);
    
    // Логирование для аналитики
    if (metrics.fromCache) {
      console.log('✅ Данные получены из кэша за', metrics.responseTime.toFixed(2), 'мс');
    } else {
      console.log('🌐 Данные получены с сервера за', metrics.responseTime.toFixed(2), 'мс');
    }
    
    return { result, metrics };
    
  } catch (error) {
    const endTime = performance.now();
    console.error('❌ Ошибка за', (endTime - startTime).toFixed(2), 'мс:', error);
    throw error;
  }
}

// Экспорт примеров для использования
export {
  getUserDataExample,
  refreshUserDataExample,
  userServiceExample,
  cacheManagementExample,
  errorHandlingExample,
  performanceMonitoringExample
};
