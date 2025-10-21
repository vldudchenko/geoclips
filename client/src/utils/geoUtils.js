/**
 * Утилиты для работы с геоданными
 */

// Расчет расстояния между двумя точками (формула Хаверсинуса)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Проверка валидности координат
export const isValidCoordinates = (lat, lon) => {
  return isFinite(lat) && isFinite(lon) && 
         lat >= -90 && lat <= 90 && 
         lon >= -180 && lon <= 180;
};

// Нормализация координат из различных форматов
export const normalizeCoordinates = (coordinates) => {
  let longitude, latitude;
  
  if (Array.isArray(coordinates)) {
    longitude = parseFloat(coordinates[0]);
    latitude = parseFloat(coordinates[1]);
  } else if (coordinates && typeof coordinates === 'object') {
    longitude = parseFloat(coordinates.longitude);
    latitude = parseFloat(coordinates.latitude);
  }
  
  return { longitude, latitude };
};
