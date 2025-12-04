import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './AdminSidebar.css';

/**
 * Боковая панель навигации административной панели
 */
const AdminSidebar = ({ collapsed, onToggle, currentPath }) => {
  const location = useLocation();

  const menuItems = [
    {
      id: 'dashboard',
      path: '/admin',
      icon: '📊',
      label: 'Дашборд',
      exact: true,
    },
    {
      id: 'users',
      path: '/admin/users',
      icon: '👥',
      label: 'Пользователи',
    },
    {
      id: 'videos',
      path: '/admin/videos',
      icon: '🎥',
      label: 'Видео',
    },
    {
      id: 'comments',
      path: '/admin/comments',
      icon: '💬',
      label: 'Комментарии',
    },
    {
      id: 'tags',
      path: '/admin/tags',
      icon: '🏷️',
      label: 'Теги',
    },
  ];

  const isActive = (item) => {
    if (item.exact) {
      return location.pathname === item.path;
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="admin-sidebar-header">
        <div className="admin-logo">
          <span className="admin-logo-icon">⚙️</span>
          {!collapsed && <span className="admin-logo-text">GeoClips Admin</span>}
        </div>
      </div>

      <nav className="admin-sidebar-nav">
        <ul className="admin-sidebar-menu">
          {menuItems.map((item) => (
            <li key={item.id} className="admin-sidebar-item">
              <Link
                to={item.path}
                className={`admin-sidebar-link ${isActive(item) ? 'active' : ''}`}
                title={collapsed ? item.label : ''}
              >
                <span className="admin-sidebar-icon">{item.icon}</span>
                {!collapsed && <span className="admin-sidebar-label">{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="admin-sidebar-footer">
        <button
          className="admin-sidebar-toggle-btn"
          onClick={onToggle}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <span className={`admin-sidebar-toggle-icon ${collapsed ? 'collapsed' : ''}`}>
            ◀
          </span>
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;