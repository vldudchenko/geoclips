import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminApiService } from '../../services/adminApiService';
import LoadingSpinner from '../common/LoadingSpinner';
import Pagination from '../common/Pagination';
import SearchBar from '../common/SearchBar';
import './AdminVideos.css';

/**
 * Компонент управления видео
 */
const AdminVideos = ({ onError }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideos, setSelectedVideos] = useState(new Set());
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'created_at');
  const [order, setOrder] = useState(searchParams.get('order') || 'desc');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('query') || '');
  const [userFilter, setUserFilter] = useState(searchParams.get('userId') || '');

  const limit = 20;

  // Загрузка видео
  const loadVideos = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const params = {
        sortBy,
        order,
        limit,
        offset: (currentPage - 1) * limit,
      };

      if (searchQuery.trim()) {
        params.query = searchQuery.trim();
      }

      if (userFilter.trim()) {
        params.userId = userFilter.trim();
      }

      const response = searchQuery.trim() || userFilter.trim()
        ? await AdminApiService.searchVideos(params)
        : await AdminApiService.getVideos(params);

      setVideos(response.videos || []);
      setTotalCount(response.total || 0);
      setTotalPages(Math.ceil((response.total || 0) / limit));

      // Обновляем URL параметры
      const newParams = new URLSearchParams();
      if (searchQuery) newParams.set('query', searchQuery);
      if (userFilter) newParams.set('userId', userFilter);
      if (sortBy !== 'created_at') newParams.set('sortBy', sortBy);
      if (order !== 'desc') newParams.set('order', order);
      if (currentPage !== 1) newParams.set('page', currentPage.toString());
      setSearchParams(newParams);

    } catch (error) {
      console.error('Ошибка загрузки видео:', error);
      if (onError) onError(error);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, order, currentPage, searchQuery, userFilter, setSearchParams]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Обработчики
  const handleSearch = (query) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleSelectVideo = (videoId) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedVideos.size === videos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(videos.map(video => video.id)));
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (!window.confirm('Вы уверены, что хотите удалить это видео? Это действие нельзя отменить.')) {
      return;
    }

    try {
      await AdminApiService.deleteVideo(videoId);
      await loadVideos();
      setSelectedVideos(new Set());
    } catch (error) {
      console.error('Ошибка удаления видео:', error);
      onError?.(error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedVideos.size === 0) return;

    if (!window.confirm(`Вы уверены, что хотите удалить ${selectedVideos.size} видео? Это действие нельзя отменить.`)) {
      return;
    }

    try {
      await AdminApiService.deleteVideos(Array.from(selectedVideos));
      await loadVideos();
      setSelectedVideos(new Set());
    } catch (error) {
      console.error('Ошибка массового удаления:', error);
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

  const getSortIcon = (field) => {
    if (sortBy !== field) return '↕️';
    return order === 'asc' ? '↑' : '↓';
  };

  const truncateText = (text, maxLength = 50) => {
    if (!text) return 'Без описания';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  if (isLoading) {
    return (
      <div className="admin-loading">
        <LoadingSpinner />
        <p>Загрузка видео...</p>
      </div>
    );
  }

  return (
    <div className="admin-videos">
      <div className="admin-videos-header">
        <div className="admin-videos-title">
          <h2>Управление видео</h2>
          <span className="admin-videos-count">
            Всего: {totalCount.toLocaleString('ru-RU')}
          </span>
        </div>
        
        <div className="admin-videos-actions">
          {selectedVideos.size > 0 && (
            <button 
              className="admin-btn admin-btn-danger"
              onClick={handleBulkDelete}
            >
              🗑️ Удалить выбранные ({selectedVideos.size})
            </button>
          )}
          <button 
            className="admin-btn admin-btn-secondary"
            onClick={loadVideos}
            title="Обновить список"
          >
            🔄 Обновить
          </button>
        </div>
      </div>

      <div className="admin-videos-controls">
        <SearchBar
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Поиск по описанию или ID..."
          className="admin-videos-search"
        />
        
        <div className="admin-videos-filters">
          <input
            type="text"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Фильтр по ID пользователя..."
            className="admin-videos-filter-input"
          />
        </div>
      </div>

      <div className="admin-videos-table-container">
        <table className="admin-videos-table">
          <thead>
            <tr>
              <th className="admin-videos-checkbox-col">
                <input
                  type="checkbox"
                  checked={selectedVideos.size === videos.length && videos.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Превью</th>
              <th 
                className="admin-videos-sortable"
                onClick={() => handleSort('description')}
              >
                Описание {getSortIcon('description')}
              </th>
              <th>Автор</th>
              <th 
                className="admin-videos-sortable"
                onClick={() => handleSort('views_count')}
              >
                Статистика {getSortIcon('views_count')}
              </th>
              <th>Теги</th>
              <th 
                className="admin-videos-sortable"
                onClick={() => handleSort('created_at')}
              >
                Дата загрузки {getSortIcon('created_at')}
              </th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video) => (
              <tr key={video.id} className="admin-videos-row">
                <td>
                  <input
                    type="checkbox"
                    checked={selectedVideos.has(video.id)}
                    onChange={() => handleSelectVideo(video.id)}
                  />
                </td>
                <td>
                  <div className="admin-videos-preview">
                    {video.video_url ? (
                      <video
                        src={video.video_url}
                        className="admin-videos-thumbnail"
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <div className="admin-videos-no-preview">🎥</div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="admin-videos-description">
                    <Link 
                      to={`/admin/videos/${video.id}`}
                      className="admin-videos-description-link"
                      title={video.description || 'Без описания'}
                    >
                      {truncateText(video.description)}
                    </Link>
                    <div className="admin-videos-id">
                      ID: <code>{video.id}</code>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="admin-videos-author">
                    <Link 
                      to={`/admin/users/${video.user_id}`}
                      className="admin-videos-author-link"
                    >
                      <img
                        src={video.users?.avatar_url || '/default-avatar.png'}
                        alt="Аватар"
                        className="admin-videos-author-avatar"
                      />
                      <span>{video.users?.display_name || 'Неизвестный'}</span>
                    </Link>
                  </div>
                </td>
                <td>
                  <div className="admin-videos-stats">
                    <div className="admin-videos-stat">
                      <span className="admin-videos-stat-icon">👁️</span>
                      <span>{video.views_count || 0}</span>
                    </div>
                    <div className="admin-videos-stat">
                      <span className="admin-videos-stat-icon">❤️</span>
                      <span>{video.likes_count || 0}</span>
                    </div>
                    <div className="admin-videos-stat">
                      <span className="admin-videos-stat-icon">💬</span>
                      <span>{video.comments_count || 0}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="admin-videos-tags">
                    {video.video_tags?.slice(0, 3).map((videoTag, index) => (
                      <span key={index} className="admin-videos-tag">
                        {videoTag.tags?.name}
                      </span>
                    ))}
                    {video.video_tags?.length > 3 && (
                      <span className="admin-videos-tag-more">
                        +{video.video_tags.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <time className="admin-videos-date">
                    {formatDate(video.created_at)}
                  </time>
                </td>
                <td>
                  <div className="admin-videos-actions-cell">
                    <Link
                      to={`/admin/videos/${video.id}`}
                      className="admin-btn admin-btn-sm admin-btn-primary"
                      title="Подробнее"
                    >
                      👁️
                    </Link>
                    <button
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => handleDeleteVideo(video.id)}
                      title="Удалить видео"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {videos.length === 0 && (
          <div className="admin-videos-empty">
            <p>
              {searchQuery || userFilter ? 'Видео не найдены' : 'Нет видео'}
            </p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          className="admin-videos-pagination"
        />
      )}
    </div>
  );
};

export default AdminVideos;