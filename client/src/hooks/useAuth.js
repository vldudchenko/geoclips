import { useState, useEffect } from 'react';
import CacheService from '../services/cacheService';
import { API_BASE_URL } from '../utils/constants';

const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Проверка авторизации при загрузке
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.isAuthenticated) {
        setUser(data.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Ошибка проверки авторизации:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Отправляем запрос на сервер для выхода
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Ошибка при отправке запроса на выход:', error);
    } finally {
      // В любом случае очищаем локальное состояние
      setUser(null);
      setIsAuthenticated(false);
      
      // Очищаем кэш приложения
      CacheService.clearAllCache();
      
      // Очищаем localStorage на всякий случай
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('yandexToken');
      
      // Очищаем все cookies (если есть)
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
    }
  };

  // Функция для получения ID пользователя из токена
  const getCurrentUserId = async () => {
    if (!user?.accessToken) {
      return null;
    }

    try {
      // Сначала пробуем использовать данные из кэша
      if (user?.dbUser?.id) {
        return user.dbUser.id;
      }

      // Fallback к API только если нет данных в кэше
      const { ServerApi } = await import('../services/serverApi');
      const result = await ServerApi.getYandexUserData(user.accessToken);
      
      if (result.success && result.userData?.id) {
        return result.userData.id;
      }
      
      return null;
    } catch (error) {
      console.error('Ошибка получения ID пользователя:', error);
      return null;
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    checkAuth,
    logout,
    getCurrentUserId
  };
};

export default useAuth;
