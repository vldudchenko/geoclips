import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { VideoService } from '../services/videoService';
import { UserService } from '../services/userService';
import { createCircleImageUrl } from '../utils/yandexUtils';
import { calculateDistance } from '../utils/geoUtils';
import VideoPlayer from './VideoPlayer';
import logger from '../utils/logger';
import { API_BASE_URL } from '../utils/constants';

const loadCacheFromStorage = (key) => {
  try {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : {};
  } catch (error) {
    logger.error(`Ошибка загрузки ${key}`, { error: error.message });
    return {};
  }
};

const saveCacheToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    logger.error(`Ошибка сохранения ${key}`, { error: error.message });
  }
};

const YandexMap = React.memo(({ ymaps, mapData, onCoordinatesSelect, currentUser, onNavigateProfile, isAuthenticated, initialEditMode = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const placemarkRef = useRef(null);
  const savedMapStateRef = useRef(null);
  const videoMarkersRef = useRef([]);
  const clustererRef = useRef(null);
  const fetchTimerRef = useRef(null);
  const lastUrlParamsRef = useRef(null);
  const isUserInteractionRef = useRef(false);
  
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [isEditMode, setIsEditMode] = useState(() => Boolean(initialEditMode && isAuthenticated));
  const [userAvatarsCache, setUserAvatarsCache] = useState(() => loadCacheFromStorage('userAvatarsCache'));
  const [circularAvatarsCache, setCircularAvatarsCache] = useState(() => loadCacheFromStorage('circularAvatarsCache'));
  const [videosLoaded, setVideosLoaded] = useState(false);

  useEffect(() => {
    if (initialEditMode && isAuthenticated) {
      setIsEditMode(true);
    }
  }, [initialEditMode, isAuthenticated]);

  const saveMapState = useCallback((center, zoom) => {
    const mapState = { center, zoom };
    savedMapStateRef.current = mapState;
    saveCacheToStorage('yandexMapState', mapState);
  }, []);

  const loadVideosInView = useCallback(async () => {
    if (!mapInstanceRef.current) return;
    try {
      setIsLoadingVideos(true);
      const center = mapInstanceRef.current.getCenter();
      const bounds = mapInstanceRef.current.getBounds();
      if (!center || !bounds) return;

      const [centerLon, centerLat] = center;
      const [[, ], [neLon, neLat]] = bounds;
      const radiusKm = Math.min(25, Math.max(0.5, calculateDistance(centerLat, centerLon, neLat, neLon)));

      const videosInRadius = await VideoService.getVideosByLocation(centerLat, centerLon, radiusKm);

      const avatarsFromJoin = {};
      videosInRadius.forEach(video => {
        if (video.users?.avatar_url) {
          avatarsFromJoin[video.user_id] = video.users.avatar_url;
        }
      });
      
      if (Object.keys(avatarsFromJoin).length > 0) {
        setUserAvatarsCache(prev => {
          const newCache = { ...prev, ...avatarsFromJoin };
          saveCacheToStorage('userAvatarsCache', newCache);
          return newCache;
        });
      }

      setVideos(videosInRadius);
      setVideosLoaded(true);
      logger.video('Загружено видео по границам', { count: videosInRadius.length, radiusKm });
    } catch (error) {
      logger.error('Ошибка загрузки видео по границам', { error: error.message });
    } finally {
      setIsLoadingVideos(false);
    }
  }, []);

  useEffect(() => {
    if (!ymaps || !mapRef.current || mapInstanceRef.current) return;

    const initialState = loadCacheFromStorage('yandexMapState') || {
      center: [55.7558, 37.6176],
      zoom: 10
    };

    mapInstanceRef.current = new ymaps.Map(mapRef.current, {
      center: initialState.center,
      zoom: initialState.zoom,
      controls: []
    });

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
          saveMapState([lon, lat], zoom);
        }
      }
    } catch {}

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
      if (!isEditMode || !isAuthenticated) return;
      onCoordinatesSelect(e.get('coords'));
    });

    const throttledLoadVideos = () => {
      if (!mapInstanceRef.current) return;
      saveMapState(mapInstanceRef.current.getCenter(), mapInstanceRef.current.getZoom());
      
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = setTimeout(loadVideosInView, 400);
    };

    mapInstanceRef.current.events.add(['boundschange', 'zoomchange'], throttledLoadVideos);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [ymaps, isEditMode, isAuthenticated, onCoordinatesSelect, saveMapState, loadVideosInView]);


  useEffect(() => {
    if (!ymaps || !mapInstanceRef.current) return;

    const timer = setTimeout(() => {
      if (!mapData || !isEditMode) {
        if (placemarkRef.current && mapInstanceRef.current?.geoObjects) {
          mapInstanceRef.current.geoObjects.remove(placemarkRef.current);
          placemarkRef.current = null;
        }
        return;
      }

      const { coordinates } = mapData;
      let longitude, latitude;
      
      if (Array.isArray(coordinates)) {
        [longitude, latitude] = coordinates.map(parseFloat);
      } else if (coordinates && typeof coordinates === 'object') {
        longitude = parseFloat(coordinates.longitude);
        latitude = parseFloat(coordinates.latitude);
      }

      if (!isFinite(longitude) || !isFinite(latitude)) return;

      if (placemarkRef.current && mapInstanceRef.current?.geoObjects) {
        mapInstanceRef.current.geoObjects.remove(placemarkRef.current);
      }

      placemarkRef.current = new ymaps.Placemark(
        [longitude, latitude],
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
        onCoordinatesSelect(placemarkRef.current.geometry.getCoordinates());
      });

      if (mapInstanceRef.current?.geoObjects) {
        mapInstanceRef.current.geoObjects.add(placemarkRef.current);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [mapData, ymaps, isEditMode, onCoordinatesSelect]);

  const createMarkerIcon = useCallback((avatarUrl) => {
    if (!avatarUrl) {
      return {
        preset: 'islands#blueCircleDotIcon',
        iconColor: '#ff6b6b',
        iconImageSize: [40, 40]
      };
    }

    return {
      iconLayout: 'default#image',
      iconImageHref: avatarUrl,
      iconImageSize: [50, 50],
      iconImageOffset: [-25, -25]
    };
  }, []);

  const closeAllBalloons = useCallback(() => {
    mapInstanceRef.current?.balloon.close();
  }, []);

  const createCircularAvatar = useCallback(async (avatarUrl) => {
    if (circularAvatarsCache[avatarUrl]) {
      return circularAvatarsCache[avatarUrl];
    }

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = avatarUrl;
      });
      
      const circularUrl = await createCircleImageUrl(avatarUrl);
      
      setCircularAvatarsCache(prev => {
        const newCache = { ...prev, [avatarUrl]: circularUrl };
        saveCacheToStorage('circularAvatarsCache', newCache);
        return newCache;
      });
      
      return circularUrl;
    } catch (error) {
      logger.error('Ошибка создания круглого аватара', { error: error.message });
      return null;
    }
  }, [circularAvatarsCache]);

  const addVideoMarkersToMap = useCallback(async (videosToAdd) => {
    if (!mapInstanceRef.current || !ymaps) return;

    if (clustererRef.current) {
      clustererRef.current.removeAll();
    } else {
      videoMarkersRef.current.forEach(marker => {
        mapInstanceRef.current?.geoObjects?.remove(marker);
      });
      videoMarkersRef.current = [];
    }

    const newPlacemarks = [];
    for (const video of videosToAdd) {
      if (!video.longitude || !video.latitude) continue;

      let avatarUrl = userAvatarsCache[video.user_id] || video.users?.avatar_url;
      
      if (avatarUrl && !userAvatarsCache[video.user_id]) {
        setUserAvatarsCache(prev => {
          const newCache = { ...prev, [video.user_id]: avatarUrl };
          saveCacheToStorage('userAvatarsCache', newCache);
          return newCache;
        });
      }

      const markerIconUrl = avatarUrl ? await createCircularAvatar(avatarUrl) : null;
      const markerIcon = createMarkerIcon(markerIconUrl);
      
      const marker = new ymaps.Placemark(
        [video.longitude, video.latitude],
        { hintContent: video.description || 'Без описания' },
        { ...markerIcon, balloonCloseButton: false, balloonAutoPan: false, balloonDisableAutoPan: true }
      );

      marker.events.add('click', async (e) => {
        e.stopPropagation();
        closeAllBalloons();
        
        try {
          const userData = await UserService.getUserById(video.user_id);
          if (userData?.display_name) {
            navigate(`/video/${userData.display_name}/${video.id}`);
          }
        } catch (error) {
          logger.error('Ошибка навигации к видео', { error: error.message });
        }
      });

      if (clustererRef.current) {
        newPlacemarks.push(marker);
      } else if (mapInstanceRef.current?.geoObjects) {
        mapInstanceRef.current.geoObjects.add(marker);
        videoMarkersRef.current.push(marker);
      }
    }

    if (clustererRef.current && newPlacemarks.length) {
      clustererRef.current.add(newPlacemarks);
    }
  }, [ymaps, closeAllBalloons, navigate, userAvatarsCache, createCircularAvatar, createMarkerIcon]);

  useEffect(() => {
    if (videos.length > 0) {
      addVideoMarkersToMap(videos);
    }
  }, [videos, addVideoMarkersToMap]);

  useEffect(() => {
    if (!ymaps || !mapInstanceRef.current || videosLoaded) return;
    const timer = setTimeout(loadVideosInView, 800);
    return () => clearTimeout(timer);
  }, [ymaps, videosLoaded, loadVideosInView]);

  useEffect(() => {
    if (!mapInstanceRef.current || !ymaps || location.pathname !== '/') {
      lastUrlParamsRef.current = null;
      return;
    }

    try {
      const params = new URLSearchParams(location.search);
      const latParam = params.get('lat');
      const lonParam = params.get('lon');
      const zParam = params.get('z');
      
      const currentUrlParams = latParam && lonParam ? `${latParam},${lonParam},${zParam || '17'}` : null;
      
      if (currentUrlParams === lastUrlParamsRef.current || !currentUrlParams) {
        if (!currentUrlParams) lastUrlParamsRef.current = null;
        return;
      }
      
      const lat = parseFloat(latParam);
      const lon = parseFloat(lonParam);
      const z = zParam ? parseInt(zParam) : 17;
      
      if (!isFinite(lat) || !isFinite(lon)) return;
      
      const zoom = isFinite(z) ? Math.min(Math.max(z, 12), 19) : 17;
      
      isUserInteractionRef.current = false;
      mapInstanceRef.current.setCenter([lon, lat], zoom);
      saveMapState([lon, lat], zoom);
      lastUrlParamsRef.current = currentUrlParams;
      
      setTimeout(loadVideosInView, 300);
    } catch (error) {
      logger.error('Ошибка обработки URL параметров', { error: error.message });
    }
  }, [location.search, location.pathname, ymaps, saveMapState, loadVideosInView]);


  const handleYandexLogin = useCallback(() => {
    window.location.href = API_BASE_URL ? `${API_BASE_URL}/auth/yandex` : 'http://localhost:5000/auth/yandex';
  }, []);

  const handleUploadVideo = useCallback(() => {
    if (!isAuthenticated) {
      alert('Для загрузки видео необходимо авторизоваться');
      return;
    }
    
    setIsEditMode(prev => {
      const newEditMode = !prev;
      
      if (!newEditMode && placemarkRef.current && mapInstanceRef.current?.geoObjects) {
        mapInstanceRef.current.geoObjects.remove(placemarkRef.current);
        placemarkRef.current = null;
        
        if (videos.length > 0) {
          setTimeout(() => addVideoMarkersToMap(videos), 100);
        }
      }
      
      return newEditMode;
    });
  }, [isAuthenticated, videos, addVideoMarkersToMap]);

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
        <div className="video-loading-indicator">
          <div className="video-loading-spinner"></div>
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
            setSelectedVideo(null);
            navigate(profilePath);
          }}
          onNavigateToMap={(mapPath) => {
            setSelectedVideo(null);
            navigate(mapPath);
          }}
        />
      )}
    </>
  );
});

export default YandexMap;