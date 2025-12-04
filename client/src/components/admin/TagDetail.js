import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminApiService } from '../../services/adminApiService';
import LoadingSpinner from '../common/LoadingSpinner';
import './TagDetail.css';

/**
 * Компонент детальной информации о теге
 */
const TagDetail = ({ onError }) => {
  const { tagId } = useParams();
  const [tag, setTag] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTag();
  }, [tagId]);

  const loadTag = async () => {
    try {
      setIsLoading(true);
      const data = await AdminApiService.getTagById(tagId);
      setTag(data.tag || data);
    } catch (error) {
      console.error('Ошибка загрузки тега:', error);
      if (onError) onError(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!tag) {
    return (
      <div className="tag-detail">
        <h2>Тег не найден</h2>
        <Link to="/admin/tags">Вернуться к списку тегов</Link>
      </div>
    );
  }

  return (
    <div className="tag-detail">
      <div className="tag-detail-header">
        <Link to="/admin/tags" className="admin-btn admin-btn-secondary">
          ← Назад к списку
        </Link>
        <h2>Детали тега</h2>
      </div>
      <div className="tag-detail-content">
        <p><strong>ID:</strong> {tag.id}</p>
        <p><strong>Название:</strong> {tag.name || 'Без названия'}</p>
        <p><strong>Создано:</strong> {tag.created_at ? new Date(tag.created_at).toLocaleString() : 'Неизвестно'}</p>
      </div>
    </div>
  );
};

export default TagDetail;

