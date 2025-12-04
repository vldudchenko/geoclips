import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoPlayer from './VideoPlayer';
import { SkeletonProfile, SkeletonCard } from './common/Skeleton';
import './ProfilePage.css';
import { API_BASE_URL } from '../utils/constants';
import { AdminApiService } from '../services/adminApiService';

const ProfilePage = React.memo(({ user, onLogout, accessToken }) => {
  const navigate = useNavigate();
  const videoRefs = useRef({});
  
  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDropdownMenu, setShowDropdownMenu] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [deletingVideo, setDeletingVideo] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const handlePreviewEnter = useCallback((id) => {
    const el = videoRefs.current[id];
    if (el) {
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  }, []);

  const handlePreviewLeave = useCallback((id) => {
    const el = videoRefs.current[id];
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, []);

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const identifier = accessToken || 'current';
        const response = await fetch(`${API_BASE_URL}/api/profile/${identifier}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          const errorMap = {
            404: 'Пользователь не найден',
            401: 'Требуется авторизация'
          };
          throw new Error(errorMap[response.status] || 'Ошибка загрузки данных профиля');
        }

        const data = await response.json();
        
        if (data.success) {
          setProfileData(data);
        } else {
          throw new Error(data.error || 'Ошибка загрузки данных');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileData();
  }, [accessToken]);

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user?.dbUser) {
        setIsAdmin(false);
        return;
      }

      try {
        const hasAccess = await AdminApiService.checkAdminAccess();
        setIsAdmin(hasAccess);
      } catch {
        setIsAdmin(false);
      }
    };

    checkAdminAccess();
  }, [user]);

  const handleVideoClick = useCallback((video) => {
    const idx = profileData?.videos?.findIndex(v => v.id === video.id) ?? -1;
    setSelectedIndex(idx);
    setSelectedVideo(video);
    if (profileData?.user?.display_name) {
      navigate(`/video/${profileData.user.display_name}/${video.id}`);
    }
  }, [profileData, navigate]);

  const handleNavigateToProfile = useCallback((profilePath) => {
    setSelectedVideo(null);
    setSelectedIndex(-1);
    const currentProfilePath = profileData?.user?.display_name 
      ? `/profile/${profileData.user.display_name}` 
      : null;
    if (profilePath !== currentProfilePath) {
      navigate(profilePath);
    }
  }, [profileData, navigate]);

  const handleNavigateToMap = useCallback((mapPath) => {
    setSelectedVideo(null);
    setSelectedIndex(-1);
    navigate(mapPath);
  }, [navigate]);

  const handleNext = useCallback(() => {
    if (!profileData?.videos || selectedIndex < 0) return;
    const nextIdx = (selectedIndex + 1) % profileData.videos.length;
    setSelectedIndex(nextIdx);
    setSelectedVideo(profileData.videos[nextIdx]);
    if (profileData?.user?.display_name) {
      navigate(`/video/${profileData.user.display_name}/${profileData.videos[nextIdx].id}`);
    }
  }, [profileData, selectedIndex, navigate]);

  const handlePrev = useCallback(() => {
    if (!profileData?.videos || selectedIndex < 0) return;
    const prevIdx = (selectedIndex - 1 + profileData.videos.length) % profileData.videos.length;
    setSelectedIndex(prevIdx);
    setSelectedVideo(profileData.videos[prevIdx]);
    if (profileData?.user?.display_name) {
      navigate(`/video/${profileData.user.display_name}/${profileData.videos[prevIdx].id}`);
    }
  }, [profileData, selectedIndex, navigate]);

  const handleDeleteVideoClick = useCallback((video) => {
    setVideoToDelete(video);
    setShowDeleteModal(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!videoToDelete || !profileData?.isCurrentUserProfile) return;

    setDeletingVideo(videoToDelete.id);
    setShowDeleteModal(false);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/video/${videoToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Ошибка при удалении видео');

      setProfileData(prev => ({
        ...prev,
        videos: prev.videos.filter(video => video.id !== videoToDelete.id),
        stats: {
          ...prev.stats,
          videosCount: prev.stats.videosCount - 1,
          totalLikes: prev.stats.totalLikes - (videoToDelete.likes_count || 0),
          totalViews: prev.stats.totalViews - (videoToDelete.views_count || 0)
        }
      }));
    } catch (error) {
      alert('Ошибка при удалении видео: ' + error.message);
    } finally {
      setDeletingVideo(null);
      setVideoToDelete(null);
    }
  }, [videoToDelete, profileData]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setVideoToDelete(null);
  }, []);

  const handleLogoutConfirm = useCallback(async () => {
    setShowLogoutModal(false);
    await onLogout();
  }, [onLogout]);

  const handleLogoutCancel = useCallback(() => {
    setShowLogoutModal(false);
  }, []);

  const handleYandexProfileClick = useCallback(() => {
    window.open('https://passport.yandex.ru/profile', '_blank');
    setShowDropdownMenu(false);
  }, []);

  const handleMenuToggle = useCallback(() => {
    setShowDropdownMenu(prev => !prev);
  }, []);

  const handleLogoutFromMenu = useCallback(() => {
    setShowDropdownMenu(false);
    setShowLogoutModal(true);
  }, []);

  const handleYandexLogin = useCallback(() => {
    window.location.href = API_BASE_URL ? `${API_BASE_URL}/auth/yandex` : 'http://localhost:5000/auth/yandex';
  }, []);

  useEffect(() => {
    if (!showDropdownMenu) return;
    
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-menu-container')) {
        setShowDropdownMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdownMenu]);

  // Обработка состояний загрузки и ошибок
  if (isLoading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-header">
            <button 
              className="home-button"
              onClick={() => navigate('/')}
              title="Вернуться на главную"
            >
              Главная
            </button>
          </div>
          <SkeletonProfile />
          <div className="videos-section">
            <div className="videos-grid">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-header">
            <button 
              className="home-button"
              onClick={() => navigate('/')}
              title="Вернуться на главную"
            >
              Главная
            </button>
          </div>
          
          <div className="profile-error">  
            {error !== 'Требуется авторизация' && (
              <div class="user-name" style={{ textAlign: 'center' }}>{error}</div>
            )}
            {error === 'Требуется авторизация' ? (
              <div className="auth-error-section">
                <button 
                  onClick={handleYandexLogin}
                  className="yandex-login-button"
                >
                  <span className="yandex-icon">Я</span>
                  Войти через Яндекс
                </button>
              </div>
            ) : (
              <></>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-error">
            <h2>Профиль не найден</h2>
            <button 
              onClick={() => navigate('/')}
              className="home-button"
            >
              Вернуться на главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { user: userData, videos, stats, isCurrentUserProfile } = profileData;

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Кнопка "Главная" */}
        <div className="profile-header">
          <button 
            className="home-button"
            onClick={() => navigate('/')}
            title="Вернуться на главную"
          >
            Главная
          </button>
          
        </div>
        
        {/* Информация о пользователе или кнопка авторизации */}
        {userData?.first_name ? (
          <div className="profile-info">
            <div className="avatar-section">
              <div className="avatar-container">
                {userData.avatar ? (
                  <img
                    src={userData.avatar}
                    className="avatar-image"
                    alt="Аватар пользователя"
                  />
                ) : (
                  <div className="avatar-placeholder">👤</div>
                )}
              </div>
            </div>

            {/* Кнопка меню в углу - только для текущего пользователя */}
            {user && isCurrentUserProfile && (
              <div className="profile-menu-container">
                <button
                  className="profile-menu-button"
                  onClick={handleMenuToggle}
                  title="Меню"
                >
                  ⋮
                </button>
                
                {/* Выпадающее меню */}
                {showDropdownMenu && (
                  <div className="profile-dropdown-menu">
                    <button
                      className="dropdown-menu-item"
                      onClick={handleYandexProfileClick}
                    >
                      🔗 Яндекс профиль
                    </button>
                    {/* Кнопка админки доступна только для администраторов */}
                    {isAdmin && (
                      <button
                        className="dropdown-menu-item"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowDropdownMenu(false);
                          window.location.href = '/admin';
                        }}
                      >
                        ⚙️ Админ панель
                      </button>
                    )}
                    <button
                      className="dropdown-menu-item logout-item"
                      onClick={handleLogoutFromMenu}
                    >
                      Выйти
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="user-fields">
              <div className="user-name">
                {`${userData.first_name} ${userData.last_name}`.trim() || 'Пользователь'}
              </div>
              
              <div className="user-stats">
                <div className="user-stat">
                  <span className="user-stat-number">{stats.videosCount}</span>
                  <span className="user-stat-label">Видео</span>
                </div>
                <div className="user-stat">
                  <span className="user-stat-number">{stats.totalLikes}</span>
                  <span className="user-stat-label">Лайки</span>
                </div>
                <div className="user-stat">
                  <span className="user-stat-number">{stats.totalViews}</span>
                  <span className="user-stat-label">Просмотры</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="guest-profile">
            <div className="guest-avatar">
              <div className="avatar-placeholder">👤</div>
            </div>
            <div className="guest-info">
              <h2>Добро пожаловать!</h2>
              <p>Для просмотра профиля и загрузки видео необходимо войти через Яндекс</p>
              <button 
                onClick={handleYandexLogin}
                className="yandex-login-button"
              >
                <span className="yandex-icon">Я</span>
                Войти через Яндекс
              </button>
            </div>
          </div>
        )}

        {/* Лента видео - для всех пользователей */}
        {userData?.first_name && (
          <div className="videos-section">
            {videos.length > 0 ? (
              <div className="videos-grid">
                {videos.map((video) => (
                  <div key={video.id} className="video-card" onClick={() => handleVideoClick(video)} onMouseEnter={() => handlePreviewEnter(video.id)} onMouseLeave={() => handlePreviewLeave(video.id)}>
                    <div className="video-thumbnail">
                      <video
                        ref={(el) => { if (el) videoRefs.current[video.id] = el; }}
                        src={video.video_url}
                        muted
                        playsInline
                        loop
                        preload="metadata"
                        className="video-thumb-video"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
                      />
                    </div>
                    <div className="video-info">
                      <h4 className="video-title">{video.description || 'Без описания'}</h4>
                      
                      {/* Теги видео */}
                      {video.tags && video.tags.length > 0 && (
                        <div className="video-tags">
                          {video.tags.map((tag) => (
                            <span key={tag.id} className="video-tag">
                              #{tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="video-stats">
                        <span className="video-likes">❤️{video.likes_count || 0}</span>
                        <span className="video-views">👁️{ video.views_count || 0}</span>
                      </div>
                    </div>
                    
                    {/* Кнопка удаления в правом нижнем углу - только для владельца видео */}
                    {isCurrentUserProfile && (
                      <button 
                        className="video-delete-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVideoClick(video);
                        }}
                        disabled={deletingVideo === video.id}
                        title="Удалить видео"
                      >
                        {deletingVideo === video.id ? '⏳' : '🗑️'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-videos">
                <div className="no-videos-icon">📹</div>
                {isCurrentUserProfile ? (
                  <>
                    <p>У вас пока нет загруженных видео</p>
                    <p className="no-videos-hинt">Загрузите первое видео на карте!</p>
                  </>
                ) : (
                  <p>Пользователь пока не выложил ни одного видео</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модальное окно подтверждения выхода */}
      {showLogoutModal && (
        <div className="modal-overlay" onClick={handleLogoutCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Подтверждение выхода</h3>
            </div>
            <div className="modal-body">
              <p>Вы действительно хотите выйти из аккаунта?</p>
            </div>
            <div className="modal-footer">
              <button
                className="modal-button cancel-button"
                onClick={handleLogoutCancel}
              >
                Отмена
              </button>
              <button
                className="modal-button confirm-button"
                onClick={handleLogoutConfirm}
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Подтверждение удаления</h3>
            </div>
            <div className="modal-body">
              <p>Вы уверены, что хотите удалить видео "{videoToDelete?.description || 'Без описания'}"?</p>
              <p className="modal-warning">Это действие нельзя отменить.</p>
            </div>
            <div className="modal-actions">
              <button
                className="modal-button cancel-button"
                onClick={handleCancelDelete}
              >
                Отмена
              </button>
              <button
                className="modal-button delete-button"
                onClick={handleConfirmDelete}
                disabled={deletingVideo === videoToDelete?.id}
              >
                {deletingVideo === videoToDelete?.id ? '⏳ Удаление...' : '🗑️ Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Видео плеер */}
      {selectedVideo && (
        <VideoPlayer 
          video={selectedVideo} 
          currentUser={user}
          onClose={() => { setSelectedVideo(null); setSelectedIndex(-1); }}
          onNavigateToProfile={handleNavigateToProfile}
          onNavigateToMap={handleNavigateToMap}
          onPrev={handlePrev}
          onNext={handleNext}
          hasPrev={profileData?.videos?.length > 1}
          hasNext={profileData?.videos?.length > 1}
          authorDisplayName={profileData?.user?.display_name}
          authorAvatar={profileData?.user?.avatar}
        />
      )}
    </div>
  );
});

export default ProfilePage;