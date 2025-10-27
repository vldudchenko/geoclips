import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoService } from '../services/videoService';
import { UserService } from '../services/userService';
import { ServerApi } from '../services/serverApi';
import './VideoPlayer.css';

const VideoPlayer = ({ video, onClose, currentUser, onPrev, onNext, hasPrev = false, hasNext = false, authorDisplayName, authorAvatar, onOpenComments, commentsCount = 0 }) => {
  const videoRef = useRef(null);
  const lastNavRef = useRef(0);
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video?.likes_count || "");
  const [isLiking, setIsLiking] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState('user');
  const [userAvatar, setUserAvatar] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [videoTags, setVideoTags] = useState([]);
  const [volume, setVolume] = useState(() => {
    // Загружаем сохраненную громкость из localStorage
    const savedVolume = localStorage.getItem('videoVolume');
    return savedVolume ? parseFloat(savedVolume) : 0;
  });

  // Получаем данные пользователя как в профиле
  useEffect(() => {
    if (video?.users) {
      const userData = {
        display_name: video.users.display_name || 'Пользователь',
        avatar_url: video.users.avatar_url
      };
      setUserDisplayName(userData.display_name);
      setUserAvatar(userData.avatar_url);
      return;
    }
    if (authorDisplayName) setUserDisplayName(authorDisplayName);
    if (authorAvatar) setUserAvatar(authorAvatar);
  }, [video, authorDisplayName, authorAvatar]);

  // Загружаем теги для видео
  useEffect(() => {
    const loadVideoTags = async () => {
      if (!video?.id) return;
      
      try {
        const tags = await VideoService.getVideoTags(video.id);
        setVideoTags(tags || []);
      } catch (error) {
        console.error('Ошибка при загрузке тегов:', error);
        setVideoTags([]);
      }
    };

    loadVideoTags();
  }, [video?.id]);

  // Загружаем состояние лайка при открытии видео
  useEffect(() => {
    const loadLikeStatus = async () => {
      if (!video?.id) return;
      try {
        const liked = await VideoService.isVideoLiked(video.id);
        setIsLiked(liked);
      } catch (error) {
        console.error('Ошибка при загрузке состояния лайка:', error);
        setIsLiked(false);
      }
    };
    loadLikeStatus();
  }, [video?.id]);


  const handleClickOutside = (e) => {
    if (e.target.classList.contains('tiktok-player-overlay')) {
      onClose();
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Автоматически запускаем видео при загрузке
  useEffect(() => {
    if (videoRef.current && video) {
      const video = videoRef.current;
      video.volume = volume; // Используем сохраненную громкость
      video.muted = volume === 0; // Отключаем звук только если громкость 0
      video.play().then(() => {
        setIsPlaying(true);
      }).catch((error) => {
        // Автовоспроизведение заблокировано браузером
      });
    }
  }, [video, volume]);

  // Навигация колесом мыши и клавишами (стрелки вверх/вниз)
  useEffect(() => {
    const onWheel = (e) => {
      if (!onPrev && !onNext) return;
      const now = Date.now();
      if (now - lastNavRef.current < 400) return; // debounce
      if (e.deltaY > 30) {
        lastNavRef.current = now;
        onNext && onNext();
      } else if (e.deltaY < -30) {
        lastNavRef.current = now;
        onPrev && onPrev();
      }
    };
    const onKey = (e) => {
      if (!onPrev && !onNext) return;
      const now = Date.now();
      if (now - lastNavRef.current < 250) return;
      if (e.key === 'ArrowDown') {
        lastNavRef.current = now;
        onNext && onNext();
      } else if (e.key === 'ArrowUp') {
        lastNavRef.current = now;
        onPrev && onPrev();
      }
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [onPrev, onNext]);

  const handleLike = async () => {
    if (!video?.id || isLiking) return;
    
    setIsLiking(true);
    
    try {
      if (isLiked) {
        // Убираем лайк
        const result = await VideoService.unlikeVideo(video.id);
        setIsLiked(false);
        setLikesCount(result.likesCount || likesCount - 1);
      } else {
        // Добавляем лайк
        const result = await VideoService.likeVideo(video.id);
        setIsLiked(true);
        setLikesCount(result.likesCount || likesCount + 1);
      }
    } catch (error) {
      console.error('Ошибка при лайке видео:', error);
      // Показываем уведомление пользователю
      alert('Ошибка при лайке видео: ' + error.message);
    } finally {
      setIsLiking(false);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    // Сохраняем громкость в localStorage
    localStorage.setItem('videoVolume', newVolume.toString());
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
  };

  const handleVideoClick = () => {
    handlePlayPause();
  };

  const handleAvatarClick = async (e) => {
    e.stopPropagation();
    
    if (!video?.user_id) return;
    
    try {
      // Получаем данные пользователя из базы данных
      const userData = await UserService.getUserById(video.user_id);
      
      if (userData?.display_name) {
        // Переходим на профиль по display_name
        navigate(`/profile/${userData.display_name}`);
      } else {
        // Fallback на ID если display_name недоступен
        navigate(`/profile/${video.user_id}`);
      }
    } catch (error) {
      console.error('Ошибка при переходе на профиль:', error);
      // Fallback на ID при ошибке
      navigate(`/profile/${video.user_id}`);
    }
  };

  const handleGoToMap = (e) => {
    e.stopPropagation();
    if (video?.latitude != null && video?.longitude != null) {
      const lat = video.latitude;
      const lon = video.longitude;
      navigate(`/?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&z=17`);
    } else {
      navigate('/');
    }
  };

  const handleDeleteVideoClick = (e) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setShowDeleteModal(false);
    
    try {
      // Получаем правильный ID пользователя из кэша
      let currentUserId = null;
      
      // Сначала пробуем использовать данные из кэша
      if (currentUser?.dbUser?.id) {
        currentUserId = currentUser.dbUser.id;
      } else if (currentUser?.accessToken) {
        // Fallback к API только если нет данных в кэше
        try {
          const response = await ServerApi.getYandexUserData(currentUser.accessToken);
          if (response.success) {
            const syncedUser = await UserService.syncUserWithYandex(response.userData);
            currentUserId = syncedUser?.id;
          }
        } catch (error) {
          console.error('Ошибка получения ID пользователя:', error);
        }
      }
      
      if (!currentUserId) {
        throw new Error('Не удалось определить ID пользователя');
      }
      
      await VideoService.deleteVideo(video.id, currentUserId);
      
      // Закрываем плеер и возвращаемся на предыдущую страницу
      onClose();
      navigate(-1);
    } catch (error) {
      console.error('❌ Ошибка при удалении видео:', error);
      alert('Ошибка при удалении видео: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

  const handleTagClick = (tagName) => {
    // Переходим на страницу поиска по тегу (пока просто закрываем плеер)
    // В будущем можно добавить страницу поиска
    console.log('Поиск по тегу:', tagName);
    // navigate(`/search?tag=${encodeURIComponent(tagName)}`);
  };

  const handleOpenComments = (e) => {
    e.stopPropagation();
    if (onOpenComments) {
      onOpenComments();
    }
  };

  const formatPublishedAt = (dt) => {
    try {
      if (!dt) return '';
      const d = new Date(dt);
      return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="tiktok-player-overlay" onClick={handleClickOutside}>
      <div className="tiktok-player-container">
        {/* Навигация по ленте (как YouTube Shorts): стрелки справа, вверх/вниз */}
        {(hasPrev || hasNext) && (
          <div className="tiktok-nav-vertical" onClick={(e) => e.stopPropagation()}>
            {hasPrev && (
              <div className="tiktok-nav-button up" onClick={() => { onPrev && onPrev(); }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
              </div>
            )}
            {hasNext && (
              <div className="tiktok-nav-button down" onClick={() => { onNext && onNext(); }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
              </div>
            )}
          </div>
        )}
        {/* Кнопка назад (улучшенная видимость) */}
        <div className="tiktok-back-button" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </div>

        {/* Основное видео */}
        <div className="tiktok-video-wrapper">
          <video
            ref={videoRef}
            src={video.video_url}
            autoPlay
            loop
            playsInline
            preload="metadata"
            className="tiktok-video"
            onClick={handleVideoClick}
          >
            Ваш браузер не поддерживает видео.
          </video>
          
          {/* Центральная кнопка play/pause */}
          {!isPlaying && (
            <div className="tiktok-play-button" onClick={handlePlayPause}>
              <svg width="60" height="60" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          )}
        </div>

        {/* Боковая панель действий */}
        <div className="tiktok-sidebar">
          {/* Аватар автора (кликабельный) */}
          <div className="tiktok-author-avatar tiktok-clickable-avatar" onClick={handleAvatarClick}>
            <img 
              src={userAvatar || "https://avatars.yandex.net/get-yapic/0/0-0/islands-200"} 
              alt="Автор" 
            />
          </div>

          

          {/* Кнопка лайка */}
          <div 
            className={`tiktok-action-button ${isLiking ? 'loading' : ''} ${!currentUser ? 'disabled' : ''}`} 
            onClick={currentUser ? handleLike : () => alert('Для лайка необходимо войти в систему')}
            style={{ 
              opacity: isLiking ? 0.6 : (!currentUser ? 0.5 : 1), 
              cursor: isLiking ? 'not-allowed' : (!currentUser ? 'not-allowed' : 'pointer') 
            }}
            title={!currentUser ? 'Войдите в систему для лайка' : ''}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill={isLiked ? "#ff0050" : "white"}>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <span className="action-count">{isLiking ? '...' : likesCount}</span>
          </div>

          {/* Кнопка комментариев */}
          <div className="tiktok-action-button" onClick={handleOpenComments} title="Комментарии">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M21.99 4c0-1.1-.89-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
            </svg>
            <span className="action-count">{commentsCount}</span>
          </div>

          {/* Кнопка поделиться
          <div className="tiktok-action-button">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
            </svg>
          </div> */}

          {/* Ползунок громкости */}
          <div className="tiktok-volume-control">
            <div className="volume-icon">
              {volume === 0 ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              ) : volume < 0.5 ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              )}
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="volume-slider vertical-slider"
              orient="vertical"
            />
          </div>

          {/* Переход к метке на карте */}
          <div className="tiktok-action-button" onClick={handleGoToMap} title="Показать на карте">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
            </svg>
          </div>

          {/* Кнопка удаления - только для своих видео */}
            {currentUser && video?.user_id === currentUser.id && (
              <div className="tiktok-action-button tiktok-delete-button" onClick={handleDeleteVideoClick}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
                <span className="action-count">{isDeleting ? '...' : ''}</span>
              </div>
            )}
        </div>

        {/* Информация о видео */}
        <div className="tiktok-video-info">
          <div className="tiktok-author-info">
            <span className="author-name">@{userDisplayName}</span>
          </div>
          <div className="tiktok-video-description">
            {video.description || 'Без описания'}
          </div>
          
          {/* Теги видео */}
          {videoTags.length > 0 && (
            <div className="tiktok-video-tags">
              {videoTags.map((tag) => (
                <span key={tag.id} className="video-tag" onClick={() => handleTagClick(tag.name)}>
                  #{tag.name}
                </span>
              ))}
            </div>
          )}        

          {/* Дата публикации */}
          <div className="tiktok-video-date">
            Опубликовано: {formatPublishedAt(video.created_at)}
          </div>
          <div className="tiktok-video-stats">
            {video.views_count || 0} просмотров
        </div>
        </div>        
      </div>

      {/* Модальное окно подтверждения удаления */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Подтверждение удаления</h3>
            </div>
            <div className="modal-body">
              <p>Вы уверены, что хотите удалить это видео "{video?.description || 'Без описания'}"?</p>
              <p className="modal-warning">Это действие нельзя отменить.</p>
            </div>
            <div className="modal-actions">
              <button
                className="modal-button cancel-button"
                onClick={handleCancelDelete}
              >
                Отмена
              </button>
              <button
                className="modal-button delete-button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? '⏳ Удаление...' : '🗑️ Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;