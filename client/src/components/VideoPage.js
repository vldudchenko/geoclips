import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoService } from '../services/videoService';
import VideoPlayer from './VideoPlayer';
import Comments from './Comments';
import './VideoPage.css';
import { API_BASE_URL } from '../utils/constants';

const VideoPage = ({ currentUser }) => {
  const { userDisplayName, videoId } = useParams();
  const navigate = useNavigate();
  const modalRef = useRef(null);
  const [video, setVideo] = useState(null);
  const [userVideos, setUserVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [author, setAuthor] = useState({ display_name: null, avatar: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentsCount, setCommentsCount] = useState(0);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [updateCommentsCountRef, setUpdateCommentsCountRef] = useState(null);
  const [isPlayerVisible, setIsPlayerVisible] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Загружаем профиль по display_name, чтобы получить всю ленту видео пользователя
        const resp = await fetch(`${API_BASE_URL}/api/profile/${userDisplayName}`, { credentials: 'include' });
        if (!resp.ok) {
          setError('Видео не найдено');
          return;
        }
        const profile = await resp.json();
        const videos = profile?.videos || [];
        setUserVideos(videos);
        setAuthor({ display_name: profile?.user?.display_name, avatar: profile?.user?.avatar });

        // Текущее видео
        const byId = videos.find(v => v.id === videoId) || await VideoService.getVideoById(videoId);
        if (!byId) {
          setError('Видео не найдено');
          return;
        }
        setVideo(byId);
        const idx = videos.findIndex(v => v.id === byId.id);
        setCurrentIndex(idx);

        // Устанавливаем счетчик комментариев из загруженного видео
        setCommentsCount(byId.comments_count || 0);

        // Регистрируем просмотр (один раз при загрузке видео)
        try { await VideoService.recordView(byId.id); } catch {}
      } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        setError('Ошибка загрузки видео');
      } finally {
        setLoading(false);
      }
    };

    if (videoId && userDisplayName) {
      loadData();
    }
  }, [videoId, userDisplayName]);

  const handleClose = () => {
    console.log('handleClose вызвана');
    // Сначала скрываем плеер для мгновенного визуального эффекта
    setIsPlayerVisible(false);
    // Затем выполняем навигацию
    setTimeout(() => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    }, 0);
  };

  const handleNavigateToProfile = (profilePath) => {
    // Сначала скрываем плеер
    setIsPlayerVisible(false);
    // Закрываем модальное окно комментариев, если открыто
    setShowCommentsModal(false);
    // Затем выполняем навигацию на профиль
    // Используем небольшую задержку для плавного закрытия плеера
    setTimeout(() => {
      navigate(profilePath);
    }, 50); // Минимальная задержка для плавного закрытия
  };

  const goNext = () => {
    if (!userVideos || userVideos.length === 0) return;
    if (currentIndex === -1) return;
    const nextIdx = (currentIndex + 1) % userVideos.length;
    setCurrentIndex(nextIdx);
    const nextVideo = userVideos[nextIdx];
    setVideo(nextVideo);
    // Обновляем счетчик комментариев для нового видео
    setCommentsCount(nextVideo.comments_count || 0);
    navigate(`/video/${userDisplayName}/${nextVideo.id}`, { replace: true });
  };

  const goPrev = () => {
    if (!userVideos || userVideos.length === 0) return;
    if (currentIndex === -1) return;
    const prevIdx = (currentIndex - 1 + userVideos.length) % userVideos.length;
    setCurrentIndex(prevIdx);
    const prevVideo = userVideos[prevIdx];
    setVideo(prevVideo);
    // Обновляем счетчик комментариев для нового видео
    setCommentsCount(prevVideo.comments_count || 0);
    navigate(`/video/${userDisplayName}/${prevVideo.id}`, { replace: true });
  };

  const handleOpenComments = () => {
    setShowCommentsModal(true);
  };

  const handleCloseComments = () => {
    setShowCommentsModal(false);
  };

  const handleCommentsCountChange = (count) => {
    setCommentsCount(count);
    // Обновляем счетчик в плеере, если функция доступна
    if (updateCommentsCountRef) {
      updateCommentsCountRef(count);
    }
  };

  const handleCommentsCountRefChange = (updateFunction) => {
    setUpdateCommentsCountRef(() => updateFunction);
  };

  // Обработка свайпа для закрытия модального окна
  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd < -100) {
      // Свайп вниз на 100px
      handleCloseComments();
    }
  };

  if (loading) {
    return (
      <div className="video-page-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="video-page-error">
        <div className="error-content">
          <h2>😔 Видео не найдено</h2>
          <p>{error || 'Запрашиваемое видео не существует'}</p>
          <button onClick={handleClose} className="back-button">
            ← Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-page">
      {/* Видеоплеер */}
      {isPlayerVisible && (
        <div className={`video-page-content ${showCommentsModal ? 'with-comments' : ''}`}>
          <VideoPlayer 
            video={video} 
            currentUser={currentUser}
            onClose={handleClose}
            onNavigateToProfile={handleNavigateToProfile}
            onPrev={userVideos.length > 1 ? goPrev : undefined}
            onNext={userVideos.length > 1 ? goNext : undefined}
            hasPrev={userVideos.length > 1}
            hasNext={userVideos.length > 1}
            authorDisplayName={author.display_name}
            authorAvatar={author.avatar}
            onOpenComments={handleOpenComments}
            commentsCount={commentsCount}
            onCommentsCountChange={handleCommentsCountRefChange}
          />
        </div>
      )}

      {/* Модальное окно комментариев (как в TikTok) */}
      {showCommentsModal && (
        <div className="comments-modal-overlay" onClick={handleCloseComments}>
          <div 
            ref={modalRef}
            className={`comments-modal ${showCommentsModal ? 'open' : ''}`}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="comments-modal-header">
              <div className="comments-modal-handle"></div>
              <h3>{commentsCount} {commentsCount === 1 ? 'комментарий' : commentsCount > 1 && commentsCount < 5 ? 'комментария' : 'комментариев'}</h3>
              <button className="comments-modal-close" onClick={handleCloseComments}>
                ✕
              </button>
            </div>
            <div className="comments-modal-content">
              <Comments 
                videoId={video.id} 
                currentUser={currentUser}
                onCommentsCountChange={handleCommentsCountChange}
                isModal={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPage;
