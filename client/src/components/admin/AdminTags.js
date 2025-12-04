import React, { useState, useEffect } from 'react';
import { AdminApiService } from '../../services/adminApiService';
import LoadingSpinner from '../common/LoadingSpinner';
import './AdminTags.css';

/**
 * Компонент управления тегами
 */
const AdminTags = ({ onError }) => {
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      setIsLoading(true);
      const data = await AdminApiService.getTags({ limit: 50 });
      setTags(Array.isArray(data) ? data : (data.tags || []));
    } catch (error) {
      console.error('Ошибка загрузки тегов:', error);
      if (onError) onError(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="admin-tags">
      <h2>Теги</h2>
      <p>Функционал в разработке</p>
      <p>Найдено тегов: {tags.length}</p>
    </div>
  );
};

export default AdminTags;

