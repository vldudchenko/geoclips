/**
 * Утилиты для работы с Яндекс API
 * Централизованная обработка данных пользователей
 */

// Обработка данных пользователя из Яндекс API
// ВАЖНО: avatar_url должен приходить из БД, а не формироваться здесь
export const processYandexData = (yandexData) => {
  const first_name = yandexData.first_name || 'Пользователь';
  const last_name = yandexData.last_name || '';
  
  // Используем avatar_url из БД вместо формирования URL Yandex
  const avatar = yandexData.avatar_url || null;

  return { first_name, last_name, avatar };
};

// Обработка fallback данных пользователя
export const processFallbackData = (user) => {
  const nameParts = (user?.displayName || 'Пользователь').split(' ');
  const first_name = nameParts[0] || 'Пользователь';
  const last_name = nameParts.slice(1).join(' ') || '';

  let avatar = null;
  const photos = user?.photos;
  if (photos?.[0]?.value) avatar = photos[0].value;

  return { first_name, last_name, avatar };
};

// Получение данных пользователя из Яндекс API
export const fetchYandexUserData = async (accessToken) => {
  try {
    const response = await fetch('https://login.yandex.ru/info?format=json', {
      headers: {
        Authorization: `OAuth ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка получения данных Яндекса:', error);
    throw error;
  }
};

// Создание круглого изображения через Canvas
export const createCircleImageUrl = (imageUrl) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const size = 50;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Белая граница
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();

      // Обрезаем изображение в круг
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.clip();

      // Рисуем изображение
      ctx.drawImage(img, 0, 0, size, size);

      // Получаем Data URL
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      console.warn('Ошибка загрузки изображения аватара:', imageUrl);
      // Возвращаем стандартный красный круг при ошибке
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      resolve(canvas.toDataURL('image/png'));
    };

    img.src = imageUrl;
  });
};


