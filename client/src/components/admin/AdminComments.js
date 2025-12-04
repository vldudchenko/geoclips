import React, { useState, useEffect } from 'react';
import { AdminApiService } from '../../services/adminApiService';
import LoadingSpinner from '../common/LoadingSpinner';
import './AdminComments.css';

/**
 * Компонент управления комментариями
 */
const AdminComments = ({ onError }) => {
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadComments();
  }, []);

  const loadComments = async () => {
    try {
      setIsLoading(true);
      const data = await AdminApiService.getComments({ limit: 50 });
      setComments(Array.isArray(data) ? data : (data.comments || []));
    } catch (error) {
      console.error('Ошибка загрузки комментариев:', error);
      if (onError) onError(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="admin-comments">
      <h2>Комментарии</h2>
      <p>Функционал в разработке</p>
      <p>Найдено комментариев: {comments.length}</p>
    </div>
  );
};

export default AdminComments;

