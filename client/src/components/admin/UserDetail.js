import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AdminApiService } from '../../services/adminApiService';
import LoadingSpinner from '../common/LoadingSpinner';
import Breadcrumbs from '../common/Breadcrumbs';
import './UserDetail.css';

/**
 * Детальная страница пользователя с навигацией по связанным сущностям
 */
const UserDetail = ({ onError }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [userVideos, setUserVideos] = useState([]);
  const [userComments, setUserComments] = useState([]);
  const [receivedComments, setReceivedComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async () => {
    try {
      setIsLoading(true);
      
      const [userData, videosData, commentsData, receivedData] = await Promise.all([
        AdminApiService.getUserById(userId),
        AdminApiService.getUserVideos(userId),
        AdminApiService.getUserComments(userId),
        AdminApiService.getUserReceivedComments(userId)
      ]);

      setUser(userData);
      setUserVideos(videosData.videos || []);
      setUserComments(commentsData.comments || []);
      setReceivedComments(receivedData.comments || []);
    } catch (error) {
      console.error('Ошибка загрузки данных пользователя:', error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!window.confirm(`Вы уверены, что хотите удалить пользователя "${user.display_name}"? Это действие нельзя отменить.`)) {
      return;
    }

    try {
      await AdminApiService.deleteUser(userId);
      navigate('/admin/users');
    } catch (error) {
      console.error('Ошибка удаления пользователя:', error);
      onError?.(error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const breadcrumbs = [
    { label: 'Дашборд', path: '/admin' },
    { label: 'Пользователи', path: '/admin/users' },
    { label: user?.display_name || 'Загрузка...', path: `/admin/users/${userId}` },
  ];

  if (isLoading) {
    return (
      <div className="admin-loading">
        <LoadingSpinner />
        <p>Загрузка данных пользователя...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-error">
        <h2>Пользователь не найден</h2>
        <Link to="/admin/users" className="admin-btn admin-btn-primary">
          Вернуться к списку пользователей
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-user-detail">
      <Breadcrumbs items={breadcrumbs} />

      <div className="admin-user-detail-header">
        <div className="admin-user-detail-info">
          <img
            src={user.avatar_url || '/default-avatar.png'}
            alt="Аватар пользователя"
            className="admin-user-detail-avatar"
          />
          <div className="admin-user-detail-text">
            <h1 className="admin-user-detail-name">{user.display_name}</h1>
            {user.first_name && user.last_name && (
              <p className="admin-user-detail-full-name">
                {user.first_name} {user.last_name}
              </p>
            )}
            <p className="admin-user-detail-id">
              ID: <code>{user.id}</code> | Yandex ID: <code>{user.yandex_id}</code>
            </p>
            <p className="admin-user-detail-date">
              Зарегистрирован: {formatDate(user.created_at)}
            </p>
          </div>
        </div>
        
        <div className="admin-user-detail-actions">
          <button 
            className="admin-btn admin-btn-secondary"
            onClick={loadUserData}
            title="Обновить данные"
          >
            🔄 Обновить
          </button>
          <button 
            className="admin-btn admin-btn-danger"
            onClick={handleDeleteUser}
            title="Удалить пользователя"
          >
            🗑️ Удалить
          </button>
        </div>
      </div>

      <div className="admin-user-detail-tabs">
        <button
          className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Обзор
        </button>
        <button
          className={`admin-tab ${activeTab === 'videos' ? 'active' : ''}`}
          onClick={() => setActiveTab('videos')}
        >
          🎥 Видео ({userVideos.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          💬 Комментарии ({userComments.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'received' ? 'active' : ''}`}
          onClick={() => setActiveTab('received')}
        >
          📥 Полученные ({receivedComments.length})
        </button>
      </div>

      <div className="admin-user-detail-content">
        {activeTab === 'overview' && (
          <div className="admin-user-overview">
            <div className="admin-user-stats-grid">
              <div className="admin-user-stat-card">
                <div className="admin-user-stat-icon">🎥</div>
                <div className="admin-user-stat-content">
                  <h3>Видео</h3>
                  <div className="admin-user-stat-number">{userVideos.length}</div>
                  <Link to={`/admin/users/${userId}?tab=videos`} className="admin-user-stat-link">
                    Посмотреть все →
                  </Link>
                </div>
              </div>

              <div className="admin-user-stat-card">
                <div className="admin-user-stat-icon">💬</div>
                <div className="admin-user-stat-content">
                  <h3>Написал комментариев</h3>
                  <div className="admin-user-stat-number">{userComments.length}</div>
                  <Link to={`/admin/users/${userId}?tab=comments`} className="admin-user-stat-link">
                    Посмотреть все →
                  </Link>
                </div>
              </div>

              <div className="admin-user-stat-card">
                <div className="admin-user-stat-icon">📥</div>
                <div className="admin-user-stat-content">
                  <h3>Получил комментариев</h3>
                  <div className="admin-user-stat-number">{receivedComments.length}</div>
                  <Link to={`/admin/users/${userId}?tab=received`} className="admin-user-stat-link">
                    Посмотреть все →
                  </Link>
                </div>
              </div>

              <div className="admin-user-stat-card">
                <div className="admin-user-stat-icon">❤️</div>
                <div className="admin-user-stat-content">
                  <h3>Лайков получено</h3>
                  <div className="admin-user-stat-number">
                    {userVideos.reduce((sum, video) => sum + (video.likes_count || 0), 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Последние видео */}
            {userVideos.length > 0 && (
              <div className="admin-user-recent-section">
                <h3>Последние видео</h3>
                <div className="admin-user-recent-videos">
                  {userVideos.slice(0, 3).map((video) => (
                    <div key={video.id} className="admin-user-recent-video">
                      <Link to={`/admin/videos/${video.id}`} className="admin-user-recent-video-link">
                        <div className="admin-user-recent-video-info">
                          <h4>{video.description || 'Без описания'}</h4>
                          <div className="admin-user-recent-video-stats">
                            <span>👁️ {video.views_count || 0}</span>
                            <span>❤️ {video.likes_count || 0}</span>
                            <span>💬 {video.comments_count || 0}</span>
                          </div>
                          <time>{formatDate(video.created_at)}</time>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
                {userVideos.length > 3 && (
                  <button 
                    className="admin-btn admin-btn-secondary"
                    onClick={() => setActiveTab('videos')}
                  >
                    Показать все видео ({userVideos.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="admin-user-videos">
            <h3>Видео пользователя</h3>
            {userVideos.length > 0 ? (
              <div className="admin-user-videos-grid">
                {userVideos.map((video) => (
                  <div key={video.id} className="admin-user-video-card">
                    <Link to={`/admin/videos/${video.id}`} className="admin-user-video-link">
                      <div className="admin-user-video-info">
                        <h4>{video.description || 'Без описания'}</h4>
                        <div className="admin-user-video-stats">
                          <span>👁️ {video.views_count || 0}</span>
                          <span>❤️ {video.likes_count || 0}</span>
                          <span>💬 {video.comments_count || 0}</span>
                        </div>
                        <time>{formatDate(video.created_at)}</time>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-user-empty">
                <p>У пользователя нет видео</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="admin-user-comments">
            <h3>Комментарии пользователя</h3>
            {userComments.length > 0 ? (
              <div className="admin-user-comments-list">
                {userComments.map((comment) => (
                  <div key={comment.id} className="admin-user-comment-card">
                    <div className="admin-user-comment-content">
                      <p>{comment.text}</p>
                      <div className="admin-user-comment-meta">
                        <Link to={`/admin/videos/${comment.video_id}`} className="admin-user-comment-video">
                          К видео: {comment.video_description}
                        </Link>
                        <time>{formatDate(comment.created_at)}</time>
                      </div>
                    </div>
                    <Link 
                      to={`/admin/comments/${comment.id}`}
                      className="admin-btn admin-btn-sm admin-btn-secondary"
                    >
                      Подробнее
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-user-empty">
                <p>Пользователь не оставлял комментариев</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'received' && (
          <div className="admin-user-received">
            <h3>Комментарии к видео пользователя</h3>
            {receivedComments.length > 0 ? (
              <div className="admin-user-comments-list">
                {receivedComments.map((comment) => (
                  <div key={comment.id} className="admin-user-comment-card">
                    <div className="admin-user-comment-content">
                      <p>{comment.text}</p>
                      <div className="admin-user-comment-meta">
                        <Link to={`/admin/videos/${comment.video_id}`} className="admin-user-comment-video">
                          К видео: {comment.video_description}
                        </Link>
                        <time>{formatDate(comment.created_at)}</time>
                      </div>
                    </div>
                    <Link 
                      to={`/admin/comments/${comment.id}`}
                      className="admin-btn admin-btn-sm admin-btn-secondary"
                    >
                      Подробнее
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-user-empty">
                <p>К видео пользователя нет комментариев</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDetail;