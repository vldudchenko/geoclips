interface ValidationErrors {
  video?: string;
}

export const validateVideoFile = (file: File | null): ValidationErrors | null => {
  const errors: ValidationErrors = {};

  if (!file) {
    errors.video = 'Выберите видео файл';
    return errors;
  }

  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.video = 'Размер файла не должен превышать 50 МБ (лимит Supabase Storage)';
    return errors;
  }

  const allowedTypes = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/quicktime',
    'video/x-quicktime',
    'video/wmv',
    'video/webm',
    'video/3gpp',
    'video/x-msvideo',
  ];

  const allowedExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.3gp'];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  const hasValidExtension = allowedExtensions.includes(fileExtension);

  if (!allowedTypes.includes(file.type) && !hasValidExtension) {
    errors.video = `Поддерживаются только видео файлы. Получен тип: ${file.type}, расширение: ${fileExtension}`;
    return errors;
  }

  return null;
};

export const checkVideoDuration = (file: File): Promise<string | null> => {
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

export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
