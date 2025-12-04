interface YandexData {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

interface ProcessedUserData {
  first_name: string;
  last_name: string;
  avatar: string | null;
}

interface FallbackUser {
  displayName?: string;
  photos?: Array<{ value: string }>;
}

export const processYandexData = (yandexData: YandexData): ProcessedUserData => {
  const first_name = yandexData.first_name || 'Пользователь';
  const last_name = yandexData.last_name || '';
  const avatar = yandexData.avatar_url || null;

  return { first_name, last_name, avatar };
};

export const processFallbackData = (user: FallbackUser): ProcessedUserData => {
  const nameParts = (user?.displayName || 'Пользователь').split(' ');
  const first_name = nameParts[0] || 'Пользователь';
  const last_name = nameParts.slice(1).join(' ') || '';

  let avatar: string | null = null;
  const photos = user?.photos;
  if (photos?.[0]?.value) avatar = photos[0].value;

  return { first_name, last_name, avatar };
};

export const fetchYandexUserData = async (accessToken: string): Promise<any> => {
  console.warn('⚠️ fetchYandexUserData устарела. Используйте ServerApi.getYandexUserData()');

  const { ServerApi } = await import('../services/serverApi');
  const result = await ServerApi.getYandexUserData(accessToken);

  if (result.success && result.userData) {
    return result.userData;
  }

  throw new Error('Ошибка получения данных пользователя');
};

export const createCircleImageUrl = (imageUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const size = 50;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      resolve('');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.drawImage(img, 0, 0, size, size);

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      resolve(canvas.toDataURL('image/png'));
    };

    img.src = imageUrl;
  });
};
