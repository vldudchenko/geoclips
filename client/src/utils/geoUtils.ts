import { Coordinates } from '../types';

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const isValidCoordinates = (lat: number, lon: number): boolean => {
  return (
    isFinite(lat) &&
    isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
};

export const normalizeCoordinates = (
  coordinates: [number, number] | { longitude: number; latitude: number }
): Coordinates => {
  let longitude: number, latitude: number;

  if (Array.isArray(coordinates)) {
    longitude = parseFloat(String(coordinates[0]));
    latitude = parseFloat(String(coordinates[1]));
  } else {
    longitude = parseFloat(String(coordinates.longitude));
    latitude = parseFloat(String(coordinates.latitude));
  }

  return { longitude, latitude };
};
