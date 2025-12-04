import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminApiService } from '../../services/adminApiService';
import LoadingSpinner from '../common/LoadingSpinner';
import Pagination from '../common/Pagination';
import SearchBar from '../common/SearchBar';
import './AdminUsers.css';

/**
 * Компонент управления пользователями
 */
const AdminUsers = ({ onError }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'created_at');
  const [order, setOrder] = useState(searchParams.get('order') || 'desc');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('query') || '');

  const limit = 20;

  // Загрузка пользователей
  const loadUsers = useCallback(async () => {
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

      const response = searchQuery.trim() 
        ? await AdminApiService.searchUsers(params)
        : await AdminApiService.getUsers(params);

      setUsers(response.users || []);
      setTotalCount(response.total || 0);
      setTotalPages(Math.ceil((response.total || 0) / limit));

      // Обновляем URL параметры
      const newParams = new URLSearchParams();
      if (searchQuery) newParams.set('query', searchQuery);
      if (sortBy !== 'created_at') newParams.set('sortBy', sortBy);
      if (order !== 'desc') newParams.set('order', order);
      if (currentPage !== 1) newParams.set('page', currentPage.toString());
      setSearchParams(newParams);

    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
      if (onError) onError(error);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, order, currentPage, searchQuery, setSearchParams]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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

  const handleSelectUser = (userId) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(user => user.id)));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя? Это действие нельзя отменить.')) {
      return;
    }

    try {
      await AdminApiService.deleteUser(userId);
      await loadUsers();
      setSelectedUsers(new Set());
    } catch (error) {
      console.error('Ошибка удаления пользователя:', error);
      onError?.(error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;

    if (!window.confirm(`Вы уверены, что хотите удалить ${selectedUsers.size} пользователей? Это действие нельзя отменить.`)) {
      return;
    }

    try {
      const promises = Array.from(selectedUsers).map(userId => 
        AdminApiService.deleteUser(userId)
      );
      await Promise.all(promises);
      await loadUsers();
      setSelectedUsers(new Set());
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

  if (isLoading) {
    return (
      <div className="admin-loading">
        <LoadingSpinner />
        <p>Загрузка пользователей...</p>
      </div>
    );
  }

  return (
    <div className="admin-users">
      <div className="admin-users-header">
        <div className="admin-users-title">
          <h2>Управление пользователями</h2>
          <span className="admin-users-count">
            Всего: {totalCount.toLocaleString('ru-RU')}
          </span>
        </div>
        
        <div className="admin-users-actions">
          {selectedUsers.size > 0 && (
            <button 
              className="admin-btn admin-btn-danger"
              onClick={handleBulkDelete}
            >
              🗑️ Удалить выбранные ({selectedUsers.size})
            </button>
          )}
          <button 
            className="admin-btn admin-btn-secondary"
            onClick={loadUsers}
            title="Обновить список"
          >
            🔄 Обновить
          </button>
        </div>
      </div>

      <div className="admin-users-controls">
        <SearchBar
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Поиск по имени, email или ID..."
          className="admin-users-search"
        />
      </div>

      <div className="admin-users-table-container">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th className="admin-users-checkbox-col">
                <input
                  type="checkbox"
                  checked={selectedUsers.size === users.length && users.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Аватар</th>
              <th 
                className="admin-users-sortable"
                onClick={() => handleSort('display_name')}
              >
                Имя {getSortIcon('display_name')}
              </th>
              <th 
                className="admin-users-sortable"
                onClick={() => handleSort('yandex_id')}
              >
                Yandex ID {getSortIcon('yandex_id')}
              </th>
              <th>Статистика</th>
              <th 
                className="admin-users-sortable"
                onClick={() => handleSort('created_at')}
              >
                Дата регистрации {getSortIcon('created_at')}
              </th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="admin-users-row">
                <td>
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user.id)}
                    onChange={() => handleSelectUser(user.id)}
                  />
                </td>
                <td>
                  <img
                    src={user.avatar_url || '/default-avatar.png'}
                    alt="Аватар"
                    className="admin-users-avatar"
                  />
                </td>
                <td>
                  <div className="admin-users-name">
                    <Link 
                      to={`/admin/users/${user.id}`}
                      className="admin-users-name-link"
                    >
                      {user.display_name || 'Без имени'}
                    </Link>
                    {user.first_name && user.last_name && (
                      <div className="admin-users-full-name">
                        {user.first_name} {user.last_name}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <code className="admin-users-yandex-id">{user.yandex_id}</code>
                </td>
                <td>
                  <div className="admin-users-stats">
                    <div className="admin-users-stat">
                      <span className="admin-users-stat-icon">🎥</span>
                      <span>{user.videosCount || 0}</span>
                    </div>
                    <div className="admin-users-stat">
                      <span className="admin-users-stat-icon">💬</span>
                      <span>{user.commentsWritten || 0}</span>
                    </div>
                    <div className="admin-users-stat">
                      <span className="admin-users-stat-icon">❤️</span>
                      <span>{user.likesReceived || 0}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <time className="admin-users-date">
                    {formatDate(user.created_at)}
                  </time>
                </td>
                <td>
                  <div className="admin-users-actions-cell">
                    <Link
                      to={`/admin/users/${user.id}`}
                      className="admin-btn admin-btn-sm admin-btn-primary"
                      title="Подробнее"
                    >
                      👁️
                    </Link>
                    <button
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => handleDeleteUser(user.id)}
                      title="Удалить пользователя"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="admin-users-empty">
            <p>
              {searchQuery ? 'Пользователи не найдены' : 'Нет пользователей'}
            </p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          className="admin-users-pagination"
        />
      )}
    </div>
  );
};

export default AdminUsers;