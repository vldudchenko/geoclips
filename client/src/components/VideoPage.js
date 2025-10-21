import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoService } from '../services/videoService';
import VideoPlayer from './VideoPlayer';
import './VideoPage.css';

const VideoPage = ({ currentUser }) => {
  const { userDisplayName, videoId } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadVideo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Получаем видео по ID
        const videoData = await VideoService.getVideoById(videoId);
        
        if (!videoData) {
          setError('Видео не найдено');
          return;
        }
        
        setVideo(videoData);
        
      } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        setError('Ошибка загрузки видео');
      } finally {
        setLoading(false);
      }
    };

    if (videoId) {
      loadVideo();
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


  if (loading) {
    return (
      <div className="video-page-loading">
        <div className="loading-spinner">⏳</div>
        <p>Загрузка видео...</p>
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
        />
      </div>
    </div>
  );
};

export default VideoPage;
