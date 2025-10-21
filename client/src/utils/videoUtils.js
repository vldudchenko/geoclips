/**
 * Утилиты для работы с видео
 */

// Валидация видео файла
export const validateVideoFile = (file) => {
  const errors = {};
  
  if (!file) {
    errors.video = 'Выберите видео файл';
    return errors;
  }

  // Проверка размера (50 МБ = 50 * 1024 * 1024 байт - лимит Supabase Storage)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.video = 'Размер файла не должен превышать 50 МБ (лимит Supabase Storage)';
    return errors;
  }

  // Проверка типа файла
  const allowedTypes = [
    'video/mp4',
    'video/avi', 
    'video/mov',
    'video/quicktime', // Альтернативный MIME-тип для .mov
    'video/x-quicktime', // Еще один вариант для .mov
    'video/wmv',
    'video/webm',
    'video/3gpp',
    'video/x-msvideo' // Альтернативный MIME-тип для .avi
  ];
  
  // Проверка расширения файла
  const allowedExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.3gp'];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  const hasValidExtension = allowedExtensions.includes(fileExtension);
  
  console.log('🔍 Клиентская валидация файла:', {
    name: file.name,
    type: file.type,
    size: file.size,
    extension: fileExtension,
    allowedMimeType: allowedTypes.includes(file.type),
    hasValidExtension: hasValidExtension
  });
  
  if (!allowedTypes.includes(file.type) && !hasValidExtension) {
    errors.video = `Поддерживаются только видео файлы. Получен тип: ${file.type}, расширение: ${fileExtension}. Разрешены MIME-типы: ${allowedTypes.join(', ')}, расширения: ${allowedExtensions.join(', ')}`;
    return errors;
  }

  return null;
};

// Проверка длительности видео
export const checkVideoDuration = (file) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      const duration = video.duration;
      if (duration > 60) {
        resolve('Длительность видео не должна превышать 60 секунд');
      } else {
        resolve(null);
      }
    };
    
    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      resolve('Не удалось загрузить видео для проверки');
    };
    
    video.src = URL.createObjectURL(file);
  });
};

// Генерация UUID
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
};

// Форматирование размера файла
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
