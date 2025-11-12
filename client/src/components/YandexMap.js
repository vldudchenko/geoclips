import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoService } from '../services/videoService';
import { UserService } from '../services/userService';
import { ServerApi } from '../services/serverApi';
import { createCircleImageUrl } from '../utils/yandexUtils';
import { calculateDistance } from '../utils/geoUtils';
import VideoPlayer from './VideoPlayer';
import logger from '../utils/logger';
import { API_BASE_URL } from '../utils/constants';

const YandexMap = ({ ymaps, mapData, onCoordinatesSelect, currentUser, onNavigateProfile, isAuthenticated, initialEditMode = false }) => {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const placemarkRef = useRef(null);
  const savedMapStateRef = useRef(null);
  const videoMarkersRef = useRef([]);
  const clustererRef = useRef(null);
  const fetchTimerRef = useRef(null);
  
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [isEditMode, setIsEditMode] = useState(() => Boolean(initialEditMode && isAuthenticated));
  const [userAvatarsCache, setUserAvatarsCache] = useState(() => {
    // Загружаем кэш аватаров из localStorage при инициализации
    try {
      const cached = localStorage.getItem('userAvatarsCache');
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      logger.error('Ошибка загрузки кэша аватаров из localStorage', { error: error.message });
      return {};
    }
  });
  const [circularAvatarsCache, setCircularAvatarsCache] = useState(() => {
    // Загружаем кэш круглых аватаров из localStorage при инициализации
    try {
      const cached = localStorage.getItem('circularAvatarsCache');
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      logger.error('Ошибка загрузки кэша круглых аватаров из localStorage', { error: error.message });
      return {};
    }
  });
  const [videosLoaded, setVideosLoaded] = useState(false); // Флаг загрузки видео

  // Функция для сохранения кэша аватаров в localStorage
  const saveAvatarsCacheToStorage = (avatarsCache) => {
    try {
      localStorage.setItem('userAvatarsCache', JSON.stringify(avatarsCache));
      logger.cache('Кэш аватаров сохранен в localStorage');
    } catch (error) {
      logger.error('Ошибка сохранения кэша аватаров в localStorage', { error: error.message });
    }
  };

  // Функция для сохранения кэша круглых аватаров в localStorage
  const saveCircularAvatarsCacheToStorage = (circularCache) => {
    try {
      localStorage.setItem('circularAvatarsCache', JSON.stringify(circularCache));
      logger.cache('Кэш круглых аватаров сохранен в localStorage');
    } catch (error) {
      logger.error('Ошибка сохранения кэша круглых аватаров в localStorage', { error: error.message });
    }
  };

  useEffect(() => {
    logger.video('selectedVideo изменился', { selectedVideo });
  }, [selectedVideo]);

  // Включаем режим редактирования при заходе на /addvideo (если авторизован)
  useEffect(() => {
    if (initialEditMode && isAuthenticated) {
      setIsEditMode(true);
    }
  }, [initialEditMode, isAuthenticated]);

  // Инициализация карты
  useEffect(() => {
    if (!ymaps || !mapRef.current) return;
    if (mapInstanceRef.current) return;

    const savedState = localStorage.getItem('yandexMapState');
    const initialState = savedState ? JSON.parse(savedState) : {
      center: [55.7558, 37.6176],
      zoom: 10
    };

    mapInstanceRef.current = new ymaps.Map(mapRef.current, {
      center: initialState.center,
      zoom: initialState.zoom,
      controls: []
    });

    // Если переданы координаты через URL-параметры, центрируем карту
    try {
      const params = new URLSearchParams(window.location.search);
      const latParam = params.get('lat');
      const lonParam = params.get('lon');
      const zParam = params.get('z');
      if (latParam && lonParam) {
        const lat = parseFloat(latParam);
        const lon = parseFloat(lonParam);
        const z = zParam ? parseInt(zParam) : 17;
        if (isFinite(lat) && isFinite(lon)) {
          const zoom = isFinite(z) ? Math.min(Math.max(z, 12), 19) : 17;
          mapInstanceRef.current.setCenter([lon, lat], zoom);
          // Сохраняем состояние
          const mapState = { center: [lon, lat], zoom };
          savedMapStateRef.current = mapState;
          localStorage.setItem('yandexMapState', JSON.stringify(mapState));
        }
      }
    } catch {}

    // Инициализация кластерера
    clustererRef.current = new ymaps.Clusterer({
      preset: 'islands#invertedVioletClusterIcons',
      groupByCoordinates: false,
      clusterDisableClickZoom: false,
      clusterHideIconOnBalloonOpen: false,
      geoObjectHideIconOnBalloonOpen: false,
      gridSize: 64,
      minClusterSize: 3
    });
    mapInstanceRef.current.geoObjects.add(clustererRef.current);

    mapInstanceRef.current.events.add('click', (e) => {
      if (!isEditMode || !isAuthenticated) {
        logger.map('Клик по карте игнорируется (не в режиме редактирования или не авторизован)');
        return;
      }
      
      const coords = e.get('coords');
      logger.map('Клик по карте', { coords });
      onCoordinatesSelect(coords);
    });

    mapInstanceRef.current.events.add(['boundschange', 'zoomchange'], () => {
      if (mapInstanceRef.current) {
        const mapState = {
          center: mapInstanceRef.current.getCenter(),
          zoom: mapInstanceRef.current.getZoom()
        };
        savedMapStateRef.current = mapState;
        localStorage.setItem('yandexMapState', JSON.stringify(mapState));

        // Дебаунс подгрузки видео по текущим границам
        if (fetchTimerRef.current) {
          clearTimeout(fetchTimerRef.current);
        }
        fetchTimerRef.current = setTimeout(() => {
          loadVideosInView();
        }, 400);
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [ymaps, isEditMode, isAuthenticated, onCoordinatesSelect]);

  // Управление меткой редактирования
  useEffect(() => {
    if (!ymaps || !mapInstanceRef.current) return;

    const timer = setTimeout(() => {
      if (!mapData || !isEditMode) {
        if (placemarkRef.current) {
          const mapInstance = mapInstanceRef.current;
          if (mapInstance && mapInstance.geoObjects) {
            mapInstance.geoObjects.remove(placemarkRef.current);
          }
          placemarkRef.current = null;
        }
        return;
      }

      let longitude, latitude;
      if (mapData.coordinates && Array.isArray(mapData.coordinates)) {
        longitude = parseFloat(mapData.coordinates[0]);
        latitude = parseFloat(mapData.coordinates[1]);
      } else if (mapData.coordinates && typeof mapData.coordinates === 'object') {
        longitude = parseFloat(mapData.coordinates.longitude);
        latitude = parseFloat(mapData.coordinates.latitude);
      }

      if (!isFinite(longitude) || !isFinite(latitude)) {
        logger.warn('Некорректные координаты', { coordinates: mapData.coordinates });
        return;
      }

      const coordinates = [longitude, latitude];

      if (placemarkRef.current) {
        const mapInstance = mapInstanceRef.current;
        if (mapInstance && mapInstance.geoObjects) {
          mapInstance.geoObjects.remove(placemarkRef.current);
        }
        placemarkRef.current = null;
      }

      placemarkRef.current = new ymaps.Placemark(
        coordinates,
        {
          balloonContent: mapData.address || 'Выбранная точка',
          hintContent: 'Кликните для получения информации'
        },
        {
          preset: 'islands#redDotIcon',
          draggable: true
        }
      );

      placemarkRef.current.events.add('dragend', () => {
        const newCoords = placemarkRef.current.geometry.getCoordinates();
        onCoordinatesSelect(newCoords);
      });

      const mapInstance = mapInstanceRef.current;
      if (!mapInstance || !mapInstance.geoObjects) return;
      mapInstance.geoObjects.add(placemarkRef.current);
    }, 300);

    return () => clearTimeout(timer);
  }, [mapData, ymaps, isEditMode, onCoordinatesSelect]);

  // Функция для создания иконки маркера
  const createMarkerIcon = (avatarUrl) => {
    if (!avatarUrl) {
      return {
        preset: 'islands#blueCircleDotIcon',
        iconColor: '#ff6b6b',
        iconImageSize: [40, 40]
      };
    }

    // Иконка с изображением аватара
    return {
      iconLayout: 'default#image',
      iconImageHref: avatarUrl,
      iconImageSize: [50, 50],
      iconImageOffset: [-25, -25]
    };
  };

  // Функция для закрытия всех балунов
  const closeAllBalloons = React.useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.balloon.close();
    }
  }, []);

  // Добавление видео маркеров на карту (с кластеризацией)
  const addVideoMarkersToMap = React.useCallback(async (videosToAdd) => {
    if (!mapInstanceRef.current || !ymaps) {
      logger.map('mapInstance or ymaps not ready');
      return;
    }

    logger.map('Добавление видеомаркеров', { count: videosToAdd.length });

    // Очищаем предыдущие маркеры
    if (clustererRef.current) {
      clustererRef.current.removeAll();
    } else {
      // fallback на прямое добавление/удаление
      videoMarkersRef.current.forEach(marker => {
        const mapInstance = mapInstanceRef.current;
        if (mapInstance && mapInstance.geoObjects) {
          mapInstance.geoObjects.remove(marker);
        }
      });
      videoMarkersRef.current = [];
    }

    // Добавляем новые маркеры
    const newPlacemarks = [];
    for (const video of videosToAdd) {
      if (!video.longitude || !video.latitude) {
        logger.warn('Видео без координат', { id: video.id });
        continue;
      }

      const coordinates = [video.longitude, video.latitude];
      
      // Определяем URL аватара для маркера ТОЛЬКО из БД-источников
      // Приоритет: 1) кэш, 2) users.avatar_url (join из БД)
      let avatarUrl = null;

      logger.avatar('Поиск аватара для видео', { id: video.id, userId: video.user_id });

      // 1. Проверяем кэш аватаров
      if (userAvatarsCache[video.user_id]) {
        avatarUrl = userAvatarsCache[video.user_id];
      }
      // 2. Проверяем данные пользователя из join запроса
      else if (video.users?.avatar_url) {
        avatarUrl = video.users.avatar_url;
        // Сохраняем в кэш
        const newCache = {
          ...userAvatarsCache,
          [video.user_id]: avatarUrl
        };
        setUserAvatarsCache(newCache);
        saveAvatarsCacheToStorage(newCache);
      }

      // Если есть аватар, создаем круглое изображение через Canvas
      let markerIconUrl = avatarUrl;
      if (avatarUrl) {
        try {
          // Проверяем кэш круглых аватаров
          if (circularAvatarsCache[avatarUrl]) {
            markerIconUrl = circularAvatarsCache[avatarUrl];
          } else {
            // Проверяем, что изображение доступно
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = (error) => reject(error);
              img.src = avatarUrl;
            });
            
            markerIconUrl = await createCircleImageUrl(avatarUrl);
            
            // Сохраняем в кэш
            const newCircularCache = {
              ...circularAvatarsCache,
              [avatarUrl]: markerIconUrl
            };
            setCircularAvatarsCache(newCircularCache);
            saveCircularAvatarsCacheToStorage(newCircularCache);
          }
        } catch (error) {
          logger.error('Ошибка создания круглого аватара', { id: video.id, error: error.message });
          markerIconUrl = null; // Используем дефолтную иконку при ошибке
        }
      } else {
        markerIconUrl = null; // Используем дефолтную иконку
      }

      // Создаем маркер
      const markerIcon = createMarkerIcon(markerIconUrl);
      const marker = new ymaps.Placemark(
        coordinates,
        { hintContent: `${video.description || 'Без описания'}` },
        { ...markerIcon, balloonCloseButton: false, balloonAutoPan: false, balloonDisableAutoPan: true }
      );

      // Обработчик клика
      marker.events.add('click', (e) => {
        logger.map('Клик по видео метке', { id: video.id });
        e.stopPropagation();
        closeAllBalloons();
        
        // Навигация к видео по новому маршруту с display_name
        const navigateToVideo = async () => {
          try {
            const userData = await UserService.getUserById(video.user_id);
            if (userData?.display_name) {
              navigate(`/video/${userData.display_name}/${video.id}`);
            } else {
              logger.warn('Display_name не найден для пользователя', { userId: video.user_id });
            }
          } catch (error) {
            logger.error('Ошибка при получении display_name пользователя', { error: error.message });
          }
        };
        
        navigateToVideo();
      });

      if (clustererRef.current) {
        newPlacemarks.push(marker);
      } else {
        const mapInstance = mapInstanceRef.current;
        if (!mapInstance || !mapInstance.geoObjects) continue;
        mapInstance.geoObjects.add(marker);
        videoMarkersRef.current.push(marker);
      }
      logger.map('Метка добавлена', { id: video.id });
    }

    if (clustererRef.current && newPlacemarks.length) {
      clustererRef.current.add(newPlacemarks);
    }
  }, [ymaps, currentUser, closeAllBalloons, navigate, userAvatarsCache, circularAvatarsCache]); // Исправлены зависимости

  // Предварительная загрузка аватаров из данных видео (для гостей)
  useEffect(() => {
    if (!videos.length) return;

    logger.loading('Предварительная загрузка аватаров из данных видео');
    
    const preloadAvatarsFromVideoData = () => {
      videos.forEach(video => {
        if (video.users?.avatar_url && !userAvatarsCache[video.user_id]) {
          logger.cache('Предварительно кэшируем аватар пользователя', { userId: video.user_id });
          const newCache = {
            ...userAvatarsCache,
            [video.user_id]: video.users.avatar_url
          };
          setUserAvatarsCache(newCache);
          saveAvatarsCacheToStorage(newCache);
        }
      });
    };

    preloadAvatarsFromVideoData();
  }, [videos, userAvatarsCache]);

  // Загрузка аватаров всех пользователей при загрузке видео
  useEffect(() => {
    if (!videos.length) return;

    const fetchAllUserAvatars = async () => {
      // Получаем уникальные ID пользователей из видео
      const uniqueUserIds = [...new Set(videos.map(video => video.user_id))];

      // Загружаем аватары только для тех пользователей, у которых нет аватара в кэше
      const usersWithoutAvatars = uniqueUserIds.filter(userId => !userAvatarsCache[userId]);
      
      if (usersWithoutAvatars.length === 0) {
        return;
      }

      // Загружаем аватары для каждого пользователя
      const avatarPromises = usersWithoutAvatars.map(async (userId) => {
        try {
          // Получаем из базы данных
          const { UserService } = await import('../services/userService');
          const userData = await UserService.getUserById(userId);
          
          if (userData?.avatar_url) {
            const newCache = {
              ...userAvatarsCache,
              [userId]: userData.avatar_url
            };
            setUserAvatarsCache(newCache);
            saveAvatarsCacheToStorage(newCache);
          }
        } catch (error) {
          logger.error('Ошибка загрузки аватара пользователя', { userId, error: error.message });
        }
      });

      await Promise.all(avatarPromises);
    };

    fetchAllUserAvatars();
  }, [videos, userAvatarsCache]); // Добавляем userAvatarsCache в зависимости

  // Пересоздаем маркеры при обновлении кэша аватаров
  useEffect(() => {
    if (videos.length > 0 && Object.keys(userAvatarsCache).length > 0) {
      addVideoMarkersToMap(videos);
    }
  }, [userAvatarsCache, videos, addVideoMarkersToMap]);

  // Загрузка видео по текущим границам (первичная и при перемещении)
  const loadVideosInView = React.useCallback(async () => {
    if (!mapInstanceRef.current) return;
    try {
      setIsLoadingVideos(true);
      const center = mapInstanceRef.current.getCenter(); // [lon, lat]
      const bounds = mapInstanceRef.current.getBounds(); // [[swLon, swLat],[neLon, neLat]]
      if (!center || !bounds) return;

      const centerLat = center[1];
      const centerLon = center[0];
      const ne = bounds[1];
      const neLat = ne[1];
      const neLon = ne[0];
      // Радиус как расстояние от центра до северо-восточного угла
      const radiusKm = Math.min(25, Math.max(0.5, calculateDistance(centerLat, centerLon, neLat, neLon)));

      const videosInRadius = await VideoService.getVideosByLocation(centerLat, centerLon, radiusKm);

      // Пре-заполняем кэш аватаров из join данных
      const avatarsFromJoin = {};
      videosInRadius.forEach(video => {
        if (video.users?.avatar_url) {
          avatarsFromJoin[video.user_id] = video.users.avatar_url;
        }
      });
      if (Object.keys(avatarsFromJoin).length > 0) {
        const newCache = { ...userAvatarsCache, ...avatarsFromJoin };
        setUserAvatarsCache(newCache);
        saveAvatarsCacheToStorage(newCache);
      }

      setVideos(videosInRadius);
      await addVideoMarkersToMap(videosInRadius);
      setVideosLoaded(true);
      logger.video('Загружено видео по границам', { count: videosInRadius.length, radiusKm });
    } catch (error) {
      logger.error('Ошибка загрузки видео по границам', { error: error.message });
    } finally {
      setIsLoadingVideos(false);
    }
  }, [addVideoMarkersToMap, userAvatarsCache]);

  useEffect(() => {
    if (!ymaps || !mapInstanceRef.current || videosLoaded) return;
    const timer = setTimeout(() => loadVideosInView(), 800);
    return () => clearTimeout(timer);
  }, [ymaps, videosLoaded, loadVideosInView]);


  // Обработчик входа через Яндекс
  const handleYandexLogin = () => {
    const authUrl = API_BASE_URL ? `${API_BASE_URL}/auth/yandex` : 'http://localhost:5000/auth/yandex';
    window.location.href = authUrl;
  };

  // Обработчик кнопки "Загрузить видео"
  const handleUploadVideo = () => {
    if (!isAuthenticated) {
      alert('Для загрузки видео необходимо авторизоваться');
      return;
    }
    
    const newEditMode = !isEditMode;
    setIsEditMode(newEditMode);
    
    if (!newEditMode) {
      if (placemarkRef.current && mapInstanceRef.current) {
        const mapInstance = mapInstanceRef.current;
        if (mapInstance && mapInstance.geoObjects) {
          mapInstance.geoObjects.remove(placemarkRef.current);
        }
        placemarkRef.current = null;
      }
      
      if (videos.length > 0) {
        setTimeout(() => {
          addVideoMarkersToMap(videos);
        }, 100);
      }
    }
  };

  return (
    <>
      {/* Navigation Bar */}
      <div className="navigation-bar">
        <div className="navigation-bar-logo">
          🌍 GeoClips
        </div>
        
        <div className="navigation-bar-buttons">
          {!isAuthenticated ? (
            // Кнопка входа для неавторизованных пользователей
            <button
              onClick={handleYandexLogin}
              className="nav-button yandex-login"
              title="Войти через Яндекс"
            >
              <span>Я</span>
              <span>Войти через Яндекс</span>
            </button>
          ) : (
            // Кнопки для авторизованных пользователей
            <>
              <button
                onClick={onNavigateProfile}
                className="nav-button"
                title="Профиль"
              >
                <span>👤</span>
                <span>Профиль</span>
              </button>
              
              <button
                onClick={handleUploadVideo}
                className={`nav-button upload-video ${isEditMode ? 'active' : ''}`}
                title={isEditMode ? 'Завершить редактирование' : 'Загрузить видео'}
              >
                <span>{isEditMode ? '✋' : '📤'}</span>
                <span>{isEditMode ? 'Отмена' : 'Загрузить видео'}</span>
              </button>
            </>
          )}
        </div>
      </div>
      
      <div
        className="map"
        ref={mapRef}
        style={{ width: '100%', height: '100%' }}
      />
      
      {isEditMode && (
        <div className="edit-mode-hint">
          Кликните на карту для создания метки
        </div>
      )}
      
      {isLoadingVideos && (
        <div className="video-loading" style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '10px 15px',
          borderRadius: '5px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: '#333'
        }}>
          <div className="video-loading-spinner" style={{
            width: '16px',
            height: '16px',
            border: '2px solid #f3f3f3',
            borderTop: '2px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span>Загрузка видео...</span>
        </div>
      )}
      
      {selectedVideo && (
        <VideoPlayer 
          video={selectedVideo} 
          currentUser={currentUser}
          onClose={() => {
            logger.video('Закрытие VideoPlayer');
            setSelectedVideo(null);
          }}
          onNavigateToProfile={(profilePath) => {
            // Закрываем плеер
            setSelectedVideo(null);
            // Выполняем навигацию на профиль
            navigate(profilePath);
          }}
        />
      )}
    </>
  );
};

export default YandexMap;