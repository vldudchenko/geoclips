/**
 * API роуты
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const config = require('../config/environment');
const logger = require('../utils/logger');
const cacheManager = require('../utils/cacheUtils');
const supabase = require('../config/supabase');
const { validateAddress, validateAccessToken } = require('../middleware/validation');
const { updateUserBasicData } = require('../services/userService');

/**
 * Геокодирование адреса
 */
router.post('/geocode', validateAddress, async (req, res) => {
  try {
    const { address } = req.body;

    const response = await axios.get('https://geocode-maps.yandex.ru/1.x/', {
      params: {
        apikey: config.yandex.apiKey,
        geocode: address,
        format: 'json',
        results: 1
      }
    });

    const data = response.data;

    if (data.response.GeoObjectCollection.featureMember.length === 0) {
      logger.warn('GEOCODE', 'Адрес не найден', { address });
      return res.status(404).json({ error: 'Адрес не найден' });
    }

    const geoObject = data.response.GeoObjectCollection.featureMember[0].GeoObject;
    const coordinates = geoObject.Point.pos.split(' ').map(Number);

    logger.success('GEOCODE', 'Адрес успешно геокодирован', { address });

    res.json({
      address: geoObject.metaDataProperty.GeocoderMetaData.text,
      coordinates: {
        longitude: coordinates[0],
        latitude: coordinates[1]
      },
      fullInfo: geoObject
    });

  } catch (error) {
    logger.error('GEOCODE', 'Ошибка геокодирования', error);
    res.status(500).json({ error: 'Ошибка сервера при геокодировании' });
  }
});

/**
 * Получение данных пользователя Яндекс с кэшированием
 */
router.get('/yandex-user-data', validateAccessToken, async (req, res) => {
  try {
    const accessToken = req.accessToken;
    const cacheKey = `yandex_user_${accessToken}`;

    // Проверяем кэш
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        userData: cachedData,
        fromCache: true
      });
    }

    logger.loading('API', 'Запрос данных пользователя из Yandex API');
    const response = await axios.get('https://login.yandex.ru/info?format=json', {
      headers: {
        'Authorization': `OAuth ${accessToken}`
      }
    });

    const userData = response.data;

    // Получаем пользователя из БД для avatar_url
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, avatar_url')
      .eq('yandex_id', userData.id)
      .maybeSingle();

    // Обрабатываем данные - используем avatar_url из БД, а не формируем URL Yandex
    const processedData = {
      id: userData.id,
      first_name: userData.first_name || 'Пользователь',
      last_name: userData.last_name || '',
      display_name: userData.display_name || userData.real_name || userData.login,
      avatar_url: dbUser?.avatar_url || null, // Берём из БД
      // Для обратной совместимости оставляем поле avatar
      avatar: dbUser?.avatar_url || null
    };

    // Сохраняем в кэш на более длительное время (30 минут)
    cacheManager.set(cacheKey, processedData, 30 * 60 * 1000);

    res.json({
      success: true,
      userData: processedData,
      fromCache: false
    });

  } catch (error) {
    logger.error('API', 'Ошибка получения данных пользователя', error);
    res.status(500).json({ error: 'Ошибка получения данных пользователя' });
  }
});

/**
 * Обновление данных пользователя через Яндекс API
 */
router.post('/update-user-data', validateAccessToken, async (req, res) => {
  try {
    const accessToken = req.body.accessToken;

    logger.loading('API', 'Обновление данных пользователя');

    // Очищаем кэш перед обновлением
    const cacheKey = `yandex_user_${accessToken}`;
    cacheManager.delete(cacheKey);

    // Получаем данные от Яндекс
    const userResponse = await axios.get('https://login.yandex.ru/info', {
      headers: {
        'Authorization': `OAuth ${accessToken}`
      }
    });

    const userInfo = userResponse.data;

    // Обновляем базовые данные
    const dbUser = await updateUserBasicData(userInfo);

    // Обновляем кэш новыми данными
    const processedData = {
      id: userInfo.id,
      first_name: userInfo.first_name || 'Пользователь',
      last_name: userInfo.last_name || '',
      display_name: userInfo.display_name || userInfo.real_name || userInfo.login,
      avatar_url: dbUser?.avatar_url || null,
      avatar: dbUser?.avatar_url || null
    };
    
    cacheManager.set(cacheKey, processedData, 30 * 60 * 1000);

    res.json({
      success: true,
      user: dbUser,
      message: 'Данные пользователя успешно обновлены'
    });

  } catch (error) {
    logger.error('API', 'Ошибка обновления данных пользователя', error);
    res.status(500).json({ error: 'Ошибка обновления данных пользователя' });
  }
});

/**
 * Очистка кэша пользователя
 */
router.delete('/yandex-user-cache', validateAccessToken, async (req, res) => {
  try {
    const accessToken = req.query.accessToken;
    const cacheKey = `yandex_user_${accessToken}`;
    const deleted = cacheManager.delete(cacheKey);

    res.json({
      success: true,
      message: deleted ? 'Кэш пользователя очищен' : 'Кэш пользователя не найден'
    });

  } catch (error) {
    logger.error('API', 'Ошибка очистки кэша', error);
    res.status(500).json({ error: 'Ошибка очистки кэша' });
  }
});

/**
 * Централизованное логирование с клиента
 */
router.post('/log', (req, res) => {
  try {
    const { level, message, data, component } = req.body;
    
    // Используем наш logger для записи логов клиента
    const logComponent = component || 'CLIENT';
    
    switch (level) {
      case 'error':
        logger.error(logComponent, message, data);
        break;
      case 'warn':
        logger.warn(logComponent, message, data);
        break;
      case 'info':
        logger.info(logComponent, message, data);
        break;
      case 'debug':
        logger.debug(logComponent, message, data);
        break;
      case 'success':
        logger.success(logComponent, message, data);
        break;
      case 'loading':
        logger.loading(logComponent, message, data);
        break;
      case 'cache':
        logger.cache(logComponent, message, data);
        break;
      case 'avatar':
      case 'video':
      case 'map':
        logger.log(level, logComponent, message, data);
        break;
      default:
        logger.info(logComponent, message, data);
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error('API', 'Ошибка обработки лога клиента', error);
    res.status(500).json({ error: 'Ошибка логирования' });
  }
});

/**
 * Логирование событий карты
 */
router.post('/log/map', (req, res) => {
  try {
    const { action, data } = req.body;
    
    let message = '';
    switch (action) {
      case 'init':
        message = 'Инициализация карты';
        break;
      case 'videos_loaded':
        message = `Загружено видео: ${data?.count || 0}`;
        break;
      case 'markers_added':
        message = `Добавлено маркеров: ${data?.count || 0}`;
        break;
      case 'marker_click':
        message = `Клик по маркеру: ${data?.videoId || 'неизвестно'}`;
        break;
      case 'map_click':
        message = 'Клик по карте';
        break;
      case 'edit_mode':
        message = `Режим редактирования: ${data?.enabled ? 'включен' : 'выключен'}`;
        break;
      default:
        message = action;
    }
    
    logger.map(message, data);
    res.json({ success: true });
  } catch (error) {
    logger.error('API', 'Ошибка логирования карты', error);
    res.status(500).json({ error: 'Ошибка логирования карты' });
  }
});

/**
 * Получение полных данных профиля пользователя
 */
router.get('/profile/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const currentUserId = req.user?.dbUser?.id; // ID текущего авторизованного пользователя
    
    let targetUserId = null;
    let userData = null;
    let isCurrentUserProfile = false;

    // Определяем тип идентификатора и получаем данные пользователя
    if (identifier === 'current') {
      // Текущий пользователь
      if (!currentUserId) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }
      targetUserId = currentUserId;
      isCurrentUserProfile = true;
    } else if (identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // Это UUID - ID пользователя
      targetUserId = identifier;
      isCurrentUserProfile = currentUserId === identifier;
    } else if (identifier.includes('_') || (identifier.includes('-') && !identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))) {
      // Это токен доступа
      try {
        const response = await axios.get('https://login.yandex.ru/info?format=json', {
          headers: {
            'Authorization': `OAuth ${identifier}`
          }
        });
        
        const yandexData = response.data;
        
        // Синхронизируем пользователя с БД
        const { updateUserBasicData } = require('../services/userService');
        const syncedUser = await updateUserBasicData(yandexData);
        
        if (syncedUser) {
          targetUserId = syncedUser.id;
          isCurrentUserProfile = currentUserId === syncedUser.id;
          userData = {
            first_name: syncedUser.first_name,
            last_name: syncedUser.last_name,
            display_name: syncedUser.display_name,
            avatar: syncedUser.avatar_url
          };
        }
      } catch (error) {
        logger.error('API', 'Ошибка получения данных по токену', error);
        return res.status(400).json({ error: 'Неверный токен доступа' });
      }
    } else {
      // Это display_name
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('display_name', identifier)
        .maybeSingle();
      
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      targetUserId = user.id;
      isCurrentUserProfile = currentUserId === user.id;
      userData = {
        first_name: user.first_name,
        last_name: user.last_name,
        display_name: user.display_name,
        avatar: user.avatar_url
      };
    }

    // Если данные пользователя еще не получены (для ID), загружаем их
    if (!userData && targetUserId) {
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', targetUserId)
        .maybeSingle();
      
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      userData = {
        first_name: user.first_name,
        last_name: user.last_name,
        display_name: user.display_name,
        avatar: user.avatar_url
      };
    }

    // Загружаем видео пользователя с тегами
    const { data: videos } = await supabase
      .from('videos')
      .select(`
        *,
        video_tags (
          tags (
            id,
            name
          )
        )
      `)
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    // Обрабатываем видео и теги
    const processedVideos = videos?.map(video => ({
      ...video,
      // Убеждаемся, что thumbnail_url - полный URL
      thumbnail_url: video.thumbnail_url ? 
        (video.thumbnail_url.startsWith('http') ? 
          video.thumbnail_url : 
          `${config.baseUrl}${video.thumbnail_url}`) : 
        null,
      tags: video.video_tags?.map(vt => vt.tags).filter(Boolean) || []
    })) || [];

    // Вычисляем статистику
    const stats = {
      videosCount: processedVideos.length,
      totalLikes: processedVideos.reduce((sum, video) => sum + (video.likes_count || 0), 0),
      totalViews: processedVideos.reduce((sum, video) => sum + (video.views_count || 0), 0)
    };

    res.json({
      success: true,
      user: userData,
      videos: processedVideos,
      stats,
      isCurrentUserProfile
    });

  } catch (error) {
    logger.error('API', 'Ошибка получения данных профиля', error);
    res.status(500).json({ error: 'Ошибка сервера при получении данных профиля' });
  }
});

/**
 * Базовый API роут
 */
router.get('/', (req, res) => {
  res.json({ message: 'API Яндекс карт работает!' });
});

module.exports = router;

