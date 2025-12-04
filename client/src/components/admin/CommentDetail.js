import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminApiService } from '../../services/adminApiService';
import LoadingSpinner from '../common/LoadingSpinner';
import './CommentDetail.css';

/**
 * Компонент детальной информации о комментарии
 */
const CommentDetail = ({ onError }) => {
  const { commentId } = useParams();
  const [comment, setComment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadComment();
  }, [commentId]);

  const loadComment = async () => {
    try {
      setIsLoading(true);
      const data = await AdminApiService.getCommentById(commentId);
      setComment(data.comment || data);
    } catch (error) {
      console.error('Ошибка загрузки комментария:', error);
      if (onError) onError(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!comment) {
    return (
      <div className="comment-detail">
        <h2>Комментарий не найден</h2>
        <Link to="/admin/comments">Вернуться к списку комментариев</Link>
      </div>
    );
  }

  return (
    <div className="comment-detail">
      <div className="comment-detail-header">
        <Link to="/admin/comments" className="admin-btn admin-btn-secondary">
          ← Назад к списку
        </Link>
        <h2>Детали комментария</h2>
      </div>
      <div className="comment-detail-content">
        <p><strong>ID:</strong> {comment.id}</p>
        <p><strong>Текст:</strong> {comment.text || 'Нет текста'}</p>
        <p><strong>Пользователь ID:</strong> {comment.user_id}</p>
        <p><strong>Видео ID:</strong> {comment.video_id}</p>
        <p><strong>Создано:</strong> {comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Неизвестно'}</p>
      </div>
    </div>
  );
};

export default CommentDetail;

