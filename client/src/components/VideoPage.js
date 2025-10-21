import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoService } from '../services/videoService';
import VideoPlayer from './VideoPlayer';
import './VideoPage.css';
import { API_BASE_URL } from '../utils/constants';

const VideoPage = ({ currentUser }) => {
  const { userDisplayName, videoId } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [userVideos, setUserVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [author, setAuthor] = useState({ display_name: null, avatar: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    // Возвращаемся на предыдущую страницу или на главную
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const goNext = () => {
    if (!userVideos || userVideos.length === 0) return;
    if (currentIndex === -1) return;
    const nextIdx = (currentIndex + 1) % userVideos.length;
    setCurrentIndex(nextIdx);
    const nextVideo = userVideos[nextIdx];
    setVideo(nextVideo);
    navigate(`/video/${userDisplayName}/${nextVideo.id}`, { replace: true });
  };

  const goPrev = () => {
    if (!userVideos || userVideos.length === 0) return;
    if (currentIndex === -1) return;
    const prevIdx = (currentIndex - 1 + userVideos.length) % userVideos.length;
    setCurrentIndex(prevIdx);
    const prevVideo = userVideos[prevIdx];
    setVideo(prevVideo);
    navigate(`/video/${userDisplayName}/${prevVideo.id}`, { replace: true });
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
      <div className="video-page-content">
        <VideoPlayer 
          video={video} 
          currentUser={currentUser}
          onClose={handleClose}
          onPrev={userVideos.length > 1 ? goPrev : undefined}
          onNext={userVideos.length > 1 ? goNext : undefined}
          hasPrev={userVideos.length > 1}
          hasNext={userVideos.length > 1}
          authorDisplayName={author.display_name}
          authorAvatar={author.avatar}
        />
      </div>
    </div>
  );
};

export default VideoPage;
