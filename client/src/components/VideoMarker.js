import React, { useState } from 'react';
import { VideoService } from '../services/videoService';
import './VideoMarker.css';

const VideoMarker = ({ video, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes_count);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleLike = async () => {
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
  };

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

  return (
    <div className="video-marker-popup">
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
              {formatDate(video.created_at)}
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
            poster={video.thumbnail_url}
          >
            Ваш браузер не поддерживает видео.
          </video>
        </div>

        <div className="video-marker-stats">
          <div className="video-marker-stat">
            <span className="video-marker-stat-icon">👁️</span>
            <span>{video.views_count}</span>
          </div>
          {video.duration_seconds && (
            <div className="video-marker-stat">
              <span className="video-marker-stat-icon">⏱️</span>
              <span>{Math.floor(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, '0')}</span>
            </div>
          )}
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
};

export default VideoMarker;
