import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoService } from '../services/videoService';
import { UserService } from '../services/userService';
import { ServerApi } from '../services/serverApi';
import { validateVideoFile, checkVideoDuration, generateUUID } from '../utils/videoUtils';

const UploadForm = ({ coordinates, onSubmit, onCancel, user }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    video: null,
    description: '',
    tags: []
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(''); // Статус загрузки

  // Загрузка тегов из базы данных
  useEffect(() => {
    const loadTags = async () => {
      try {
        setLoadingTags(true);
        const tags = await VideoService.getAllTags();
        setAvailableTags(tags.map(tag => tag.name));
      } catch (error) {
        console.error('❌ Ошибка при загрузке тегов:', error);
        // Fallback к предустановленным тегам
        setAvailableTags([
          'природа', 'город', 'архитектура', 'люди', 'транспорт', 
          'еда', 'спорт', 'развлечения', 'работа', 'путешествия'
        ]);
      } finally {
        setLoadingTags(false);
      }
    };

    loadTags();
  }, []);


  // Обработка выбора видео
  const handleVideoChange = async (e) => {
    const file = e.target.files[0];
    setErrors({ ...errors, video: null });
    
    if (!file) {
      setFormData({ ...formData, video: null });
      return;
    }

    // Валидация размера и типа
    const validationError = validateVideoFile(file);
    if (validationError) {
      setErrors({ ...errors, ...validationError });
      return;
    }

    // Проверка длительности на сервере
    try {
      const validationResult = await ServerApi.validateVideo(file);
      if (!validationResult.isValid) {
        setErrors({ ...errors, video: validationResult.errorMessage });
        return;
      }
    } catch (error) {
      // Fallback к клиентской проверке
      const durationError = await checkVideoDuration(file);
      if (durationError) {
        setErrors({ ...errors, video: durationError });
        return;
      }
    }

    setFormData({ ...formData, video: file });
  };

  // Обработка изменения описания
  const handleDescriptionChange = (e) => {
    const value = e.target.value;
    if (value.length <= 100) {
      setFormData({ ...formData, description: value });
      setErrors({ ...errors, description: null });
    }
  };

  // Добавление тега
  const addTag = (tag) => {
    if (!formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
    }
  };

  // Удаление тега
  const removeTag = (tagToRemove) => {
    setFormData({ 
      ...formData, 
      tags: formData.tags.filter(tag => tag !== tagToRemove) 
    });
  };

  // Создание нового тега
  const createNewTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag) && !availableTags.includes(tag)) {
      addTag(tag);
      setNewTag('');
    }
  };

  // Обработка отправки формы
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    setUploadProgress(0);
    setUploadStatus('Подготовка к загрузке...');

    // Валидация
    const newErrors = {};
    
    if (!formData.video) {
      newErrors.video = 'Выберите видео файл';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Введите описание';
    }
    
    if (formData.tags.length === 0) {
      newErrors.tags = 'Выберите хотя бы один тег';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      setUploadStatus('Синхронизация пользователя...');
      
      // Сначала пробуем использовать данные из кэша
      let syncedUser = null;
      
      if (user?.dbUser?.id) {
        // Используем данные из кэша
        syncedUser = user.dbUser;
      } else {
        // Fallback к синхронизации только если нет данных в кэше
        syncedUser = await UserService.syncUserWithYandex(user);
      }
      
      setUploadProgress(10);
      setUploadStatus('Подготовка файла...');
      
      // Создаем временный ID для видео
      const videoId = generateUUID();
      
      setUploadProgress(20);
      setUploadStatus('Загрузка видео...');
      
      // Загружаем файл в Supabase Storage
      const uploadResult = await VideoService.uploadVideoFile(
        formData.video, 
        syncedUser.id, 
        videoId
      );
      
      setUploadProgress(60);
      setUploadStatus('Обработка данных...');
      
      // Получаем публичный URL видео
      const videoUrl = VideoService.getVideoUrl(uploadResult.path);
      
      // Подготавливаем данные для БД
      const videoData = {
        id: videoId,
        user_id: syncedUser.id,
        description: formData.description.trim(),
        video_url: videoUrl,
        latitude: coordinates[1],
        longitude: coordinates[0],
        duration_seconds: null, // Можно добавить позже
        likes_count: 0,
        views_count: 0,
        tags: formData.tags // Добавляем теги
      };
      
      setUploadProgress(80);
      setUploadStatus('Сохранение в базу данных...');
      
      // Сохраняем видео в БД
      const savedVideo = await VideoService.uploadVideo(videoData);
      
      setUploadProgress(100);
      setUploadStatus('Загрузка завершена!');
      
      // Небольшая задержка для показа финального статуса
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Переход в профиль пользователя
      if (syncedUser?.display_name) {
        navigate(`/profile/${syncedUser.display_name}`);
      } else if (syncedUser?.id) {
        navigate(`/profile/${syncedUser.id}`);
      } else if (user?.accessToken) {
        navigate(`/profile/${user.accessToken}`);
      } else {
        navigate('/profile');
      }
      
      // Вызываем callback с результатом
      await onSubmit({
        success: true,
        video: savedVideo,
        message: 'Видео успешно загружено!'
      });
      
    } catch (error) {
      console.error('Ошибка при загрузке видео:', error);
      setUploadStatus('Ошибка при загрузке');
      setUploadProgress(0);
      
      // Обработка специфических ошибок
      let errorMessage = 'Произошла ошибка при загрузке видео';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.code === 'FILE_TOO_LARGE') {
        errorMessage = 'Файл слишком большой. Максимальный размер: 50 МБ (лимит Supabase Storage)';
      } else if (error.code === 'TOO_MANY_FILES') {
        errorMessage = 'Слишком много файлов. Максимум: 1 файл';
      }
      
      setErrors({ 
        submit: errorMessage
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="upload-form-container">
      <div className="upload-form">
        <h3>Загрузка данных</h3>
        
        <form onSubmit={handleSubmit}>
        <div className="form-group">
            <label>Теги:</label>
            
            {/* Доступные теги */}
            <div className="available-tags">
              {loadingTags ? (
                <div className="tags-loading">Загрузка тегов...</div>
              ) : (
                availableTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    disabled={formData.tags.includes(tag)}
                    className={`tag-button ${formData.tags.includes(tag) ? 'selected' : ''}`}
                  >
                    {tag}
                  </button>
                ))
              )}
            </div>
          {/* Создание нового тега */}
          <div className="new-tag-section">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Создать новый тег..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), createNewTag())}
              />
              <button type="button" onClick={createNewTag} disabled={!newTag.trim()}>
                Добавить
              </button>
            </div>

            {/* Выбранные теги */}
            {formData.tags.length > 0 && (
              <div className="selected-tags">
                <strong>Выбранные теги:</strong>
                {formData.tags.map(tag => (
                  <span key={tag} className="selected-tag">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)}>×</button>
                  </span>
                ))}
              </div>
            )}

          {/* Описание */}
          <div className="form-group">
            <label htmlFor="description">Описание:</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={handleDescriptionChange}
              placeholder="Введите описание..."
              className={errors.description ? 'error' : ''}
              rows={Math.max(3, Math.ceil(formData.description.length / 50))}
            />
            <div className="char-counter">
              {formData.description.length}/100 символов
            </div>
            {errors.description && <div className="error-message">{errors.description}</div>}
          </div>

          {/* Видео */}
          <div className="form-group">
            <div className="file-upload-container">
              <input
                type="file"
                id="video"
                accept="video/mp4,video/avi,video/mov,video/quicktime,video/x-quicktime,video/wmv,video/webm,video/3gpp,video/x-msvideo,.mp4,.avi,.mov,.wmv,.webm,.3gp"
                onChange={handleVideoChange}
                className="file-input-hidden"
              />
              <label htmlFor="video" className="file-upload-button">
                📹 Загрузка видео
              </label>
            </div>
            {formData.video && (
              <div className="file-info">
                📹 {formData.video.name} ({(formData.video.size / 1024 / 1024).toFixed(2)} МБ)
              </div>
            )}
            {errors.video && <div className="error-message">{errors.video}</div>}
          </div>   
            {errors.tags && <div className="error-message">{errors.tags}</div>}
          </div>

          {/* Ошибки отправки */}
          {errors.submit && <div className="error-message">{errors.submit}</div>}

          {/* Индикатор загрузки */}
          {isSubmitting && (
            <div className="upload-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <div className="upload-status">{uploadStatus}</div>
            </div>
          )}

          {/* Кнопки */}
          <div className="form-actions">
            <button type="button" onClick={onCancel} disabled={isSubmitting}>
              Отмена
            </button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Загрузка...' : 'Загрузить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadForm;
