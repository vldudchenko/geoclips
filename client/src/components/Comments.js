import React, { useState, useEffect, useCallback } from 'react';
import './Comments.css';
import { API_BASE_URL } from '../utils/constants';

const Comments = ({ videoId, currentUser, onCommentsCountChange, isModal = false }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [saving, setSaving] = useState(false);

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
      
      // Обновляем счетчик комментариев если он пришел с сервера
      if (data.total !== undefined && onCommentsCountChange) {
        onCommentsCountChange(data.total);
      }
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
      
      // Обновляем счетчик комментариев если он пришел с сервера
      if (data.commentsCount !== undefined && onCommentsCountChange) {
        onCommentsCountChange(data.commentsCount);
      }
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

      const data = await response.json();

      // Удаляем комментарий из списка
      setComments(comments.filter(c => c.id !== commentId));
      
      // Обновляем счетчик комментариев если он пришел с сервера
      if (data.commentsCount !== undefined && onCommentsCountChange) {
        onCommentsCountChange(data.commentsCount);
      }
    } catch (err) {
      console.error('Ошибка удаления комментария:', err);
      alert('Не удалось удалить комментарий');
    }
  };

  const handleEdit = (comment) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.text);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (commentId) => {
    if (!editingText.trim()) {
      alert('Комментарий не может быть пустым');
      return;
    }

    if (editingText.length > 1000) {
      alert('Комментарий не может быть длиннее 1000 символов');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/api/comments/${commentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ text: editingText.trim() })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ошибка обновления комментария');
      }

      const data = await response.json();
      
      // Обновляем комментарий в списке
      // Ответ от сервера имеет структуру: { success: true, comment: {...} }
      const updatedComment = data.comment || data;
      setComments(comments.map(c => 
        c.id === commentId ? updatedComment : c
      ));
      
      // Сбрасываем состояние редактирования
      setEditingCommentId(null);
      setEditingText('');
      setSaving(false);
    } catch (err) {
      console.error('Ошибка обновления комментария:', err);
      alert('Не удалось обновить комментарий: ' + err.message);
      setSaving(false);
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
                {currentUser && (currentUser.dbUser?.id === comment.users?.id || currentUser.id === comment.users?.id) && (
                  <div className="comment-actions">
                    {editingCommentId === comment.id ? (
                      <>
                        <button
                          className="comment-save-btn"
                          onClick={() => handleSaveEdit(comment.id)}
                          disabled={saving}
                          title="Сохранить изменения"
                        >
                          {saving ? '⏳' : '✓'}
                        </button>
                        <button
                          className="comment-cancel-btn"
                          onClick={handleCancelEdit}
                          disabled={saving}
                          title="Отменить редактирование"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="comment-edit-btn"
                          onClick={() => handleEdit(comment)}
                          title="Редактировать комментарий"
                        >
                          ✏️
                        </button>
                        <button
                          className="comment-delete-btn"
                          onClick={() => handleDelete(comment.id)}
                          title="Удалить комментарий"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {editingCommentId === comment.id ? (
                <div className="comment-edit-form">
                  <textarea
                    className="comment-edit-input"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    disabled={saving}
                  />
                  <div className="comment-edit-footer">
                    <span className="comment-length">
                      {editingText.length}/1000
                    </span>
                  </div>
                </div>
              ) : (
                <div className="comment-text">
                  {comment.text}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Comments;

