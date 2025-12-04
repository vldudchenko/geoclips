import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AdminApiService } from '../../services/adminApiService';
import LoadingSpinner from '../common/LoadingSpinner';
import './AdminDashboard.css';

/**
 * Главная страница административной панели с общей статистикой
 */
const AdminDashboard = ({ onError }) => {
  const [stats, setStats] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      const [statsData, activitiesData] = await Promise.all([
        AdminApiService.getDashboardStats(),
        AdminApiService.getRecentActivities(10)
      ]);

      setStats(statsData);
      setRecentActivities(activitiesData);
    } catch (error) {
      console.error('Ошибка загрузки данных дашборда:', error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ru-RU').format(num || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="admin-dashboard-loading">
        <LoadingSpinner />
        <p>Загрузка статистики...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-header">
        <h2>Обзор системы</h2>
        <button 
          className="admin-btn admin-btn-secondary"
          onClick={loadDashboardData}
          title="Обновить данные"
        >
          🔄 Обновить
        </button>
      </div>

      {/* Основная статистика */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div className="admin-stat-content">
            <h3>Пользователи</h3>
            <div className="admin-stat-number">{formatNumber(stats?.users?.total)}</div>
            <div className="admin-stat-details">
              <span>Новых за неделю: {formatNumber(stats?.users?.newThisWeek)}</span>
            </div>
          </div>
          <Link to="/admin/users" className="admin-stat-link">
            Управление →
          </Link>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">🎥</div>
          <div className="admin-stat-content">
            <h3>Видео</h3>
            <div className="admin-stat-number">{formatNumber(stats?.videos?.total)}</div>
            <div className="admin-stat-details">
              <span>Загружено за неделю: {formatNumber(stats?.videos?.newThisWeek)}</span>
            </div>
          </div>
          <Link to="/admin/videos" className="admin-stat-link">
            Управление →
          </Link>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">💬</div>
          <div className="admin-stat-content">
            <h3>Комментарии</h3>
            <div className="admin-stat-number">{formatNumber(stats?.comments?.total)}</div>
            <div className="admin-stat-details">
              <span>Новых за неделю: {formatNumber(stats?.comments?.newThisWeek)}</span>
            </div>
          </div>
          <Link to="/admin/comments" className="admin-stat-link">
            Управление →
          </Link>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon">🏷️</div>
          <div className="admin-stat-content">
            <h3>Теги</h3>
            <div className="admin-stat-number">{formatNumber(stats?.tags?.total)}</div>
            <div className="admin-stat-details">
              <span>Активных: {formatNumber(stats?.tags?.active)}</span>
            </div>
          </div>
          <Link to="/admin/tags" className="admin-stat-link">
            Управление →
          </Link>
        </div>
      </div>

      {/* Дополнительная статистика */}
      <div className="admin-additional-stats">
        <div className="admin-stat-row">
          <div className="admin-stat-item">
            <span className="admin-stat-label">Всего просмотров:</span>
            <span className="admin-stat-value">{formatNumber(stats?.totalViews)}</span>
          </div>
          <div className="admin-stat-item">
            <span className="admin-stat-label">Всего лайков:</span>
            <span className="admin-stat-value">{formatNumber(stats?.totalLikes)}</span>
          </div>
          <div className="admin-stat-item">
            <span className="admin-stat-label">Средний рейтинг:</span>
            <span className="admin-stat-value">
              {stats?.averageRating ? `${stats.averageRating.toFixed(1)}/5` : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Последние активности */}
      <div className="admin-recent-activities">
        <h3>Последние активности</h3>
        {recentActivities.length > 0 ? (
          <div className="admin-activities-list">
            {recentActivities.map((activity, index) => (
              <div key={index} className="admin-activity-item">
                <div className="admin-activity-icon">
                  {activity.type === 'user_registered' && '👤'}
                  {activity.type === 'video_uploaded' && '🎥'}
                  {activity.type === 'comment_added' && '💬'}
                  {activity.type === 'tag_created' && '🏷️'}
                </div>
                <div className="admin-activity-content">
                  <div className="admin-activity-text">{activity.description}</div>
                  <div className="admin-activity-time">{formatDate(activity.created_at)}</div>
                </div>
                {activity.link && (
                  <Link to={activity.link} className="admin-activity-link">
                    Подробнее →
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-no-activities">
            <p>Нет последних активностей</p>
          </div>
        )}
      </div>

      {/* Быстрые действия */}
      <div className="admin-quick-actions">
        <h3>Быстрые действия</h3>
        <div className="admin-quick-actions-grid">
          <button 
            className="admin-quick-action-btn"
            onClick={() => AdminApiService.fixViewsCounters()}
            title="Пересчитать счетчики просмотров"
          >
            <span className="admin-quick-action-icon">🔧</span>
            <span>Исправить счетчики просмотров</span>
          </button>
          
          <button 
            className="admin-quick-action-btn"
            onClick={() => AdminApiService.updateTagCounters()}
            title="Обновить счетчики использования тегов"
          >
            <span className="admin-quick-action-icon">🏷️</span>
            <span>Обновить счетчики тегов</span>
          </button>
          
          <Link to="/admin/users?sortBy=created_at&order=desc" className="admin-quick-action-btn">
            <span className="admin-quick-action-icon">👥</span>
            <span>Новые пользователи</span>
          </Link>
          
          <Link to="/admin/videos?sortBy=created_at&order=desc" className="admin-quick-action-btn">
            <span className="admin-quick-action-icon">🎥</span>
            <span>Последние видео</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;