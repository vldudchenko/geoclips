import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminApiService } from '../../services/adminApiService';
import LoadingSpinner from '../common/LoadingSpinner';
import './VideoDetail.css';

/**
 * Компонент детальной информации о видео
 */
const VideoDetail = ({ onError }) => {
  const { videoId } = useParams();
  const [video, setVideo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadVideo();
  }, [videoId]);

  const loadVideo = async () => {
    try {
      setIsLoading(true);
      const data = await AdminApiService.getVideoById(videoId);
      setVideo(data.video || data);
    } catch (error) {
      console.error('Ошибка загрузки видео:', error);
      if (onError) onError(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!video) {
    return (
      <div className="video-detail">
        <h2>Видео не найдено</h2>
        <Link to="/admin/videos">Вернуться к списку видео</Link>
      </div>
    );
  }

  return (
    <div className="video-detail">
      <div className="video-detail-header">
        <Link to="/admin/videos" className="admin-btn admin-btn-secondary">
          ← Назад к списку
        </Link>
        <h2>Детали видео</h2>
      </div>
      <div className="video-detail-content">
        <p><strong>ID:</strong> {video.id}</p>
        <p><strong>Название:</strong> {video.title || 'Без названия'}</p>
        <p><strong>Описание:</strong> {video.description || 'Нет описания'}</p>
        <p><strong>Пользователь ID:</strong> {video.user_id}</p>
        <p><strong>Создано:</strong> {video.created_at ? new Date(video.created_at).toLocaleString() : 'Неизвестно'}</p>
      </div>
    </div>
  );
};

export default VideoDetail;

