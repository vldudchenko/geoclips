export interface User {
  id: string;
  yandex_id?: string;
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthUser {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  real_name?: string;
  avatar_url?: string;
  accessToken?: string;
  dbUser?: User;
}

export interface Video {
  id: string;
  user_id: string;
  description: string;
  video_url: string;
  latitude: number;
  longitude: number;
  likes_count: number;
  views_count: number;
  created_at: string;
  updated_at?: string;
  tags?: Tag[];
  users?: User;
}

export interface Tag {
  id: string;
  name: string;
  created_at?: string;
}

export interface Comment {
  id: string;
  video_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  users?: User;
}

export interface MapData {
  coordinates: {
    latitude: number;
    longitude: number;
  } | [number, number];
  address?: string;
  timestamp?: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ProfileData {
  success: boolean;
  user: User;
  videos: Video[];
  stats: {
    videosCount: number;
    totalLikes: number;
    totalViews: number;
  };
  isCurrentUserProfile: boolean;
}

export interface UploadFormData {
  video: File | null;
  description: string;
  tags: string[];
}

export interface ApiResponse<T = any> extends Record<string, any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface VideoUploadData {
  success: boolean;
  video: Video;
  message: string;
}
