import { Video, Tag, ApiResponse } from '../types';
import { SERVER_URL } from '../utils/constants';

interface VideoUploadData {
  id: string;
  user_id: string;
  description: string;
  video_url: string;
  latitude: number;
  longitude: number;
  likes_count: number;
  views_count: number;
  created_at?: string;
  tags: string[];
}

interface UploadResult {
  path: string;
  filePath?: string;
}

export class VideoService {
  static handleError(error: any, context = ''): never {
    console.error(`VideoService Error [${context}]:`, error);

    if (error.message?.includes('404') || error.message?.includes('не найден')) {
      throw new Error('Запись не найдена');
    }
    if (error.message?.includes('401') || error.message?.includes('авторизации')) {
      throw new Error('Ошибка авторизации. Попробуйте войти снова.');
    }

    throw error;
  }

  static async fetchFromServer<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T | null> {
    try {
      const response = await fetch(`${SERVER_URL || ''}/api${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: options.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted:', endpoint);
        return null;
      }
      throw error;
    }
  }

  static async getAllVideos(): Promise<Video[]> {
    try {
      const result = await this.fetchFromServer<ApiResponse<{ videos: Video[] }>>('/videos');

      if (result?.success && result.videos) {
        return result.videos;
      }

      return [];
    } catch (error) {
      this.handleError(error, 'getAllVideos');
    }
  }

  static async getVideosByLocation(
    latitude: number,
    longitude: number,
    radiusKm = 1
  ): Promise<Video[]> {
    try {
      const params = new URLSearchParams({
        lat: String(latitude),
        lon: String(longitude),
        radius: String(radiusKm),
      });
      const response = await fetch(`/api/videos/near?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Ошибка получения видео');
      }
      const payload = await response.json();
      return payload.videos || [];
    } catch (error) {
      console.error('Error fetching videos by location:', error);
      return [];
    }
  }

  static async getAllVideosWithCoordinates(): Promise<Video[]> {
    try {
      const result = await this.getAllVideos();
      return result.filter((video) => video.latitude && video.longitude);
    } catch (error) {
      this.handleError(error, 'getAllVideosWithCoordinates');
    }
  }

  static async uploadVideo(videoData: VideoUploadData): Promise<Video> {
    try {
      const { tags, ...rest } = videoData;
      const allowedKeys = [
        'id',
        'user_id',
        'description',
        'video_url',
        'latitude',
        'longitude',
        'likes_count',
        'views_count',
        'created_at',
      ];
      const videoDataForDb: any = {};
      for (const key of allowedKeys) {
        if ((rest as any)[key] !== undefined) {
          videoDataForDb[key] = (rest as any)[key];
        }
      }
      if (videoDataForDb.latitude !== undefined)
        videoDataForDb.latitude = parseFloat(videoDataForDb.latitude);
      if (videoDataForDb.longitude !== undefined)
        videoDataForDb.longitude = parseFloat(videoDataForDb.longitude);

      const result = await this.fetchFromServer<ApiResponse<{ video: Video }>>('/videos', {
        method: 'POST',
        body: JSON.stringify({ ...videoDataForDb, tags }),
      });

      if (result?.success && result.video) {
        return result.video;
      }

      throw new Error('Ошибка загрузки видео');
    } catch (error) {
      this.handleError(error, 'uploadVideo');
    }
  }

  static async addTagsToVideo(videoId: string, tagNames: string[]): Promise<void> {
    try {
      const result = await this.fetchFromServer<ApiResponse>(`/videos/${videoId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tags: tagNames }),
      });

      if (!result?.success) {
        throw new Error('Ошибка добавления тегов');
      }
    } catch (error) {
      this.handleError(error, 'addTagsToVideo');
    }
  }

  static async getOrCreateTag(tagName: string): Promise<string> {
    try {
      const result = await this.fetchFromServer<ApiResponse<{ tag: { id: string } }>>(
        `/tags/get-or-create`,
        {
          method: 'POST',
          body: JSON.stringify({ name: tagName }),
        }
      );

      if (result?.success && result.tag) {
        return result.tag.id;
      }

      throw new Error('Ошибка получения или создания тега');
    } catch (error) {
      this.handleError(error, 'getOrCreateTag');
    }
  }

  static async uploadVideoFile(
    file: File,
    userId: string,
    videoId: string
  ): Promise<UploadResult> {
    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('userId', userId);
      formData.append('videoId', videoId);

      const response = await fetch(`${SERVER_URL || ''}/api/videos/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error?.includes('большой') || errorData.error?.includes('size')) {
          throw new Error('Файл слишком большой (лимит: 50MB)');
        }
        throw new Error(errorData.error || 'Ошибка загрузки файла');
      }

      const result = await response.json();
      return { path: result.path || result.filePath };
    } catch (error) {
      this.handleError(error, 'uploadVideoFile');
    }
  }

  static getVideoUrl(filePath: string): string {
    if (filePath.startsWith('http')) {
      return filePath;
    }
    return filePath;
  }

  static async deleteVideo(videoId: string): Promise<boolean> {
    try {
      const result = await this.fetchFromServer<ApiResponse>(`/videos/${videoId}`, {
        method: 'DELETE',
      });

      if (result?.success) {
        return true;
      }

      throw new Error('Ошибка удаления видео');
    } catch (error) {
      console.error('Error deleting video:', error);
      throw error;
    }
  }

  static async likeVideo(videoId: string): Promise<any> {
    try {
      const response = await fetch(`/api/videos/${videoId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при лайке видео');
      }

      return await response.json();
    } catch (error) {
      console.error('Error liking video:', error);
      throw error;
    }
  }

  static async unlikeVideo(videoId: string): Promise<any> {
    try {
      const response = await fetch(`/api/videos/${videoId}/like`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при удалении лайка');
      }

      return await response.json();
    } catch (error) {
      console.error('Error unliking video:', error);
      throw error;
    }
  }

  static async isVideoLiked(videoId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/videos/${videoId}/like-status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при проверке статуса лайка');
      }

      const data = await response.json();
      return data.isLiked;
    } catch (error) {
      console.error('Error checking like status:', error);
      return false;
    }
  }

  static async recordView(videoId: string): Promise<number | null> {
    try {
      const response = await fetch(`/api/videos/${videoId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data?.viewsCount ?? null;
    } catch (e) {
      console.error('Error recording view:', e);
      return null;
    }
  }

  static async getVideoById(videoId: string): Promise<Video | null> {
    try {
      const result = await this.fetchFromServer<ApiResponse<{ video: Video }>>(
        `/videos/${videoId}`
      );

      if (result?.success && result.video) {
        return result.video;
      }

      return null;
    } catch (error) {
      this.handleError(error, 'getVideoById');
    }
  }

  static async getVideoTags(videoId: string): Promise<Tag[]> {
    try {
      const result = await this.fetchFromServer<ApiResponse<{ tags: Tag[] }>>(
        `/videos/${videoId}/tags`
      );

      if (result?.success && result.tags) {
        return result.tags;
      }

      return [];
    } catch (error) {
      this.handleError(error, 'getVideoTags');
    }
  }

  static async getAllTags(): Promise<Tag[]> {
    try {
      const result = await this.fetchFromServer<ApiResponse<{ tags: Tag[] }>>('/tags');

      if (result?.success && result.tags) {
        return result.tags;
      }

      return [];
    } catch (error) {
      console.error('❌ Ошибка при получении тегов:', error);
      throw error;
    }
  }

  static async getUserById(userId: string): Promise<any> {
    try {
      const { UserService } = await import('./userService');
      return await UserService.getUserById(userId);
    } catch (error) {
      console.error('❌ Error fetching user by ID:', error);
      throw error;
    }
  }
}
