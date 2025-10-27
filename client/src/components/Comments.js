import React, { useState, useEffect, useCallback } from 'react';
import './Comments.css';
import { API_BASE_URL } from '../utils/constants';

const Comments = ({ videoId, currentUser, onCommentsCountChange, isModal = false }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/api/comments/video/${videoId}?limit=100`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Ошибка загрузки комментариев');
      }

      const data = await response.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error('Ошибка загрузки комментариев:', err);
      setError('Не удалось загрузить комментарии');
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    if (videoId) {
      loadComments();
    }
  }, [videoId, loadComments]);

  // Уведомляем родителя об изменении количества комментариев
  useEffect(() => {
    if (onCommentsCountChange) {
      onCommentsCountChange(comments.length);
    }
  }, [comments.length, onCommentsCountChange]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      alert('Необходимо авторизоваться для добавления комментариев');
      return;
    }

    if (!newComment.trim()) {
      return;
    }

    if (newComment.length > 1000) {
      alert('Комментарий не может быть длиннее 1000 символов');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/api/comments/video/${videoId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ text: newComment.trim() })
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка добавления комментария');
      }

      const data = await response.json();
      
      // Добавляем новый комментарий в начало списка
      setComments([data.comment, ...comments]);
      setNewComment('');
    } catch (err) {
      console.error('Ошибка добавления комментария:', err);
      alert('Не удалось добавить комментарий. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Удалить этот комментарий?')) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/comments/${commentId}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка удаления комментария');
      }

      // Удаляем комментарий из списка
      setComments(comments.filter(c => c.id !== commentId));
    } catch (err) {
      console.error('Ошибка удаления комментария:', err);
      alert('Не удалось удалить комментарий');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} д назад`;

    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <div className={`comments-section ${isModal ? 'modal-mode' : ''}`}>
      {!isModal && (
        <div className="comments-header">
          <h3>💬 Комментарии {comments.length > 0 && `(${comments.length})`}</h3>
        </div>
      )}

      {/* Форма добавления комментария */}
      {currentUser ? (
        <form className="comment-form" onSubmit={handleSubmit}>
          <div className="comment-input-wrapper">
            {currentUser.avatar_url && (
              <img 
                src={currentUser.avatar_url} 
                alt="Avatar" 
                className="comment-avatar"
              />
            )}
            <textarea
              className="comment-input"
              placeholder="Написать комментарий..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              maxLength={1000}
              rows={3}
              disabled={submitting}
            />
          </div>
          <div className="comment-form-footer">
            <span className="comment-length">
              {newComment.length}/1000
            </span>
            <button
              type="submit"
              className="comment-submit-btn"
              disabled={!newComment.trim() || submitting}
            >
              {submitting ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </form>
      ) : (
        <div className="comment-auth-prompt">
          <p>Войдите, чтобы оставить комментарий</p>
        </div>
      )}

      {/* Список комментариев */}
      <div className="comments-list">
        {loading ? (
          <div className="comments-loading">
            <div className="loading-spinner"></div>
            <p>Загрузка комментариев...</p>
          </div>
        ) : error ? (
          <div className="comments-error">
            <p>{error}</p>
            <button onClick={loadComments} className="retry-btn">
              Попробовать снова
            </button>
          </div>
        ) : comments.length === 0 ? (
          <div className="comments-empty">
            <p>Пока нет комментариев. Будьте первым!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="comment-item">
              <div className="comment-header">
                <div className="comment-author">
                  {comment.users?.avatar_url && (
                    <img 
                      src={comment.users.avatar_url} 
                      alt="Avatar" 
                      className="comment-avatar"
                    />
                  )}
                  <span className="comment-author-name">
                    {comment.users?.display_name || 'Пользователь'}
                  </span>
                  <span className="comment-date">
                    {formatDate(comment.created_at)}
                    {comment.is_edited && (
                      <span className="comment-edited" title={`Изменено ${formatDate(comment.updated_at)}`}>
                        {' '}(изменено)
                      </span>
                    )}
                  </span>
                </div>
                {currentUser && currentUser.id === comment.users?.id && (
                  <button
                    className="comment-delete-btn"
                    onClick={() => handleDelete(comment.id)}
                    title="Удалить комментарий"
                  >
                    🗑️
                  </button>
                )}
              </div>
              <div className="comment-text">
                {comment.text}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Comments;

