import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import AdminSidebar from './AdminSidebar';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminVideos from './AdminVideos';
import AdminComments from './AdminComments';
import AdminTags from './AdminTags';
import UserDetail from './UserDetail';
import VideoDetail from './VideoDetail';
import CommentDetail from './CommentDetail';
import TagDetail from './TagDetail';
import { AdminApiService } from '../../services/adminApiService';
import './AdminPanel.css';

/**
 * Главный компонент административной панели
 * Обеспечивает единую точку входа и навигацию между разделами
 */
const AdminPanel = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Проверка прав доступа
  useEffect(() => {
    const checkAdminAccess = async () => {
      // Ждем завершения загрузки авторизации
      if (authLoading) {
        return;
      }

      try {
        if (!user) {
          navigate('/');
          return;
        }

        // Проверяем права администратора
        const hasAccess = await AdminApiService.checkAdminAccess();
        
        if (!hasAccess) {
          setError('У вас нет прав доступа к административной панели');
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        setIsCheckingAccess(false);
      } catch (err) {
        console.error('Ошибка проверки прав доступа:', err);
        setError('Ошибка проверки прав доступа');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    checkAdminAccess();
  }, [user, authLoading, navigate]);

  // Обработчик ошибок для дочерних компонентов
  const handleError = (error) => {
    console.error('Admin Panel Error:', error);
    setError(error.message || 'Произошла ошибка');
  };

  // Очистка ошибки
  const clearError = () => {
    setError(null);
  };

  if (authLoading || isCheckingAccess) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-spinner"></div>
        <p>Загрузка административной панели...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error">
        <div className="admin-error-content">
          <h2>Ошибка доступа</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')} className="admin-btn admin-btn-primary">
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`admin-panel ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <AdminSidebar 
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        currentPath={location.pathname}
      />
      
      <main className="admin-main">
        <div className="admin-header">
          <div className="admin-header-left">
            <button 
              className="admin-sidebar-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
            >
              <span className="hamburger-icon">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
            <h1 className="admin-title">Административная панель</h1>
          </div>
          
          <div className="admin-header-right">
            <div className="admin-user-info">
              <img 
                src={user?.dbUser?.avatar_url || '/default-avatar.png'} 
                alt="Аватар"
                className="admin-user-avatar"
              />
              <span className="admin-user-name">
                {user?.dbUser?.display_name || 'Администратор'}
              </span>
            </div>
            <button 
              className="admin-btn admin-btn-secondary"
              onClick={() => navigate('/')}
              title="Вернуться на сайт"
            >
              Выйти из админки
            </button>
          </div>
        </div>

        {error && (
          <div className="admin-error-banner">
            <span>{error}</span>
            <button onClick={clearError} className="admin-error-close">×</button>
          </div>
        )}

        <div className="admin-content">
          <Routes>
            <Route path="/" element={<AdminDashboard onError={handleError} />} />
            <Route path="/users" element={<AdminUsers onError={handleError} />} />
            <Route path="/users/:userId" element={<UserDetail onError={handleError} />} />
            <Route path="/videos" element={<AdminVideos onError={handleError} />} />
            <Route path="/videos/:videoId" element={<VideoDetail onError={handleError} />} />
            <Route path="/comments" element={<AdminComments onError={handleError} />} />
            <Route path="/comments/:commentId" element={<CommentDetail onError={handleError} />} />
            <Route path="/tags" element={<AdminTags onError={handleError} />} />
            <Route path="/tags/:tagId" element={<TagDetail onError={handleError} />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;