import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { VideoService } from '../services/videoService';
import './VideoMarker.css';

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const VideoMarker = React.memo(({ video, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes_count);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const latParam = params.get('lat');
      const lonParam = params.get('lon');
      if (latParam && lonParam && video?.latitude != null && video?.longitude != null) {
        const lat = parseFloat(latParam);
        const lon = parseFloat(lonParam);
        const dLat = Math.abs(lat - Number(video.latitude));
        const dLon = Math.abs(lon - Number(video.longitude));
        if (dLat < 0.0005 && dLon < 0.0005) {
          setHighlight(true);
          const t = setTimeout(() => setHighlight(false), 10000);
          return () => clearTimeout(t);
        }
      }
    } catch {}
  }, [video]);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);

  const handleLike = useCallback(async () => {
    try {
      if (isLiked) {
        await VideoService.unlikeVideo(video.id, video.user_id);
        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        await VideoService.likeVideo(video.id, video.user_id);
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Ошибка при лайке:', error);
    }
  }, [isLiked, video.id, video.user_id]);

  const formattedDate = useMemo(() => formatDate(video.created_at), [video.created_at]);

  return (
    <div className={`video-marker-popup${highlight ? ' highlight' : ''}`}>
      <div className="video-marker-header">
        <div className="video-marker-user">
          <img 
            src={video.users?.avatar_url || '/default-avatar.png'} 
            alt="Аватар"
            className="video-marker-avatar"
          />
          <div className="video-marker-user-info">
            <div className="video-marker-username">
              {video.users?.display_name || 'Пользователь'}
            </div>
            <div className="video-marker-date">
              {formattedDate}
            </div>
          </div>
        </div>
        <button 
          className="video-marker-close"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="video-marker-content">
        <h3 className="video-marker-title">{video.description || 'Без описания'}</h3>
        
        {video.description && (
          <p className="video-marker-description">{video.description}</p>
        )}

        <div className="video-marker-player">
          <video
            src={video.video_url}
            controls
            onPlay={handlePlay}
            onPause={handlePause}
            className="video-marker-video"
          >
            Ваш браузер не поддерживает видео.
          </video>
        </div>

        <div className="video-marker-stats">
          <div className="video-marker-stat">
            <span className="video-marker-stat-icon">👁️</span>
            <span>{video.views_count}</span>
          </div>
        </div>

        <div className="video-marker-actions">
          <button 
            className={`video-marker-like ${isLiked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            <span className="video-marker-like-icon">
              {isLiked ? '❤️' : '🤍'}
            </span>
            <span>{likesCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default VideoMarker;
