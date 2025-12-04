import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoService } from '../services/videoService';
import { UserService } from '../services/userService';
import { ServerApi } from '../services/serverApi';
import { validateVideoFile, checkVideoDuration, generateUUID } from '../utils/videoUtils';

const DEFAULT_TAGS = ['природа', 'город', 'архитектура', 'люди', 'транспорт', 'еда', 'спорт', 'развлечения', 'работа', 'путешествия'];

const UploadForm = React.memo(({ coordinates, onSubmit, onCancel, user }) => {
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
  const [uploadStatus, setUploadStatus] = useState('');

  useEffect(() => {
    const loadTags = async () => {
      try {
        setLoadingTags(true);
        const tags = await VideoService.getAllTags();
        setAvailableTags(tags.map(tag => tag.name));
      } catch {
        setAvailableTags(DEFAULT_TAGS);
      } finally {
        setLoadingTags(false);
      }
    };
    loadTags();
  }, []);


  const handleVideoChange = useCallback(async (e) => {
    const file = e.target.files[0];
    setErrors(prev => ({ ...prev, video: null }));
    
    if (!file) {
      setFormData(prev => ({ ...prev, video: null }));
      return;
    }

    const validationError = validateVideoFile(file);
    if (validationError) {
      setErrors(prev => ({ ...prev, ...validationError }));
      return;
    }

    try {
      const validationResult = await ServerApi.validateVideo(file);
      if (!validationResult.isValid) {
        setErrors(prev => ({ ...prev, video: validationResult.errorMessage }));
        return;
      }
    } catch {
      const durationError = await checkVideoDuration(file);
      if (durationError) {
        setErrors(prev => ({ ...prev, video: durationError }));
        return;
      }
    }

    setFormData(prev => ({ ...prev, video: file }));
  }, []);

  const handleDescriptionChange = useCallback((e) => {
    const value = e.target.value;
    if (value.length <= 100) {
      setFormData(prev => ({ ...prev, description: value }));
      setErrors(prev => ({ ...prev, description: null }));
    }
  }, []);

  const addTag = useCallback((tag) => {
    setFormData(prev => {
      if (prev.tags.includes(tag)) return prev;
      return { ...prev, tags: [...prev.tags, tag] };
    });
  }, []);

  const removeTag = useCallback((tagToRemove) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(tag => tag !== tagToRemove) }));
  }, []);

  const createNewTag = useCallback(() => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag) && !availableTags.includes(tag)) {
      addTag(tag);
      setNewTag('');
    }
  }, [newTag, formData.tags, availableTags, addTag]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    setUploadProgress(0);
    setUploadStatus('Подготовка к загрузке...');

    const newErrors = {};
    if (!formData.video) newErrors.video = 'Выберите видео файл';
    if (!formData.description.trim()) newErrors.description = 'Введите описание';
    if (formData.tags.length === 0) newErrors.tags = 'Выберите хотя бы один тег';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      setUploadStatus('Синхронизация пользователя...');
      const syncedUser = user?.dbUser?.id ? user.dbUser : await UserService.syncUserWithYandex(user);
      
      setUploadProgress(10);
      setUploadStatus('Подготовка файла...');
      const videoId = generateUUID();
      
      setUploadProgress(20);
      setUploadStatus('Загрузка видео...');
      const uploadResult = await VideoService.uploadVideoFile(formData.video, syncedUser.id, videoId);
      
      setUploadProgress(60);
      setUploadStatus('Обработка данных...');
      const videoUrl = VideoService.getVideoUrl(uploadResult.path);
      if (!videoUrl) throw new Error('Не удалось получить публичный URL загруженного видео');
      
      const videoData = {
        id: videoId,
        user_id: syncedUser.id,
        description: formData.description.trim(),
        video_url: videoUrl,
        latitude: coordinates[1],
        longitude: coordinates[0],
        likes_count: 0,
        views_count: 0,
        tags: formData.tags
      };
      
      setUploadProgress(80);
      setUploadStatus('Сохранение в базу данных...');
      const savedVideo = await VideoService.uploadVideo(videoData);
      
      setUploadProgress(100);
      setUploadStatus('Загрузка завершена!');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onCancel?.();

      const profilePath = syncedUser?.display_name 
        ? `/profile/${syncedUser.display_name}` 
        : syncedUser?.id 
          ? `/profile/${syncedUser.id}` 
          : user?.accessToken 
            ? `/profile/${user.accessToken}` 
            : '/profile';
      navigate(profilePath);
      
      await onSubmit({ success: true, video: savedVideo, message: 'Видео успешно загружено!' });
    } catch (error) {
      setUploadStatus('Ошибка при загрузке');
      setUploadProgress(0);
      
      const errorMap = {
        'FILE_TOO_LARGE': 'Файл слишком большой (лимит: 50MB)',
        'TOO_MANY_FILES': 'Слишком много файлов (максимум: 1)'
      };
      
      const errorMessage = error.message 
        || error.response?.data?.error 
        || errorMap[error.code]
        || 'Произошла ошибка при загрузке видео';
      
      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, coordinates, user, navigate, onCancel, onSubmit]);

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
});

export default UploadForm;
