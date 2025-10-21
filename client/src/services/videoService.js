import { supabase } from '../lib/supabase';
import { calculateDistance } from '../utils/geoUtils';

/**
 * Сервис для работы с видео
 * Оптимизированная версия с улучшенной обработкой ошибок
 */
export class VideoService {
  // Базовые поля для SELECT запросов видео
  static get VIDEO_SELECT_FIELDS() {
    return `
      id,
      user_id,
      description,
      video_url,
      thumbnail_url,
      latitude,
      longitude,
      duration_seconds,
      likes_count,
      views_count,
      created_at,
      updated_at,
      users (
        id,
        yandex_id,
        display_name,
        avatar_url
      ),
      video_tags (
        tags (
          id,
          name,
          usage_count
        )
      )
    `;
  }

  /**
   * Обработка ошибок Supabase
   */
  static handleError(error, context = '') {
    console.error(`VideoService Error [${context}]:`, error);
    
    if (error.code === 'PGRST116') {
      throw new Error('Запись не найдена');
    }
    if (error.message?.includes('JWT')) {
      throw new Error('Ошибка авторизации. Попробуйте войти снова.');
    }
    
    throw error;
  }

  /**
   * Получить все видео
   */
  static async getAllVideos() {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select(this.VIDEO_SELECT_FIELDS)
        .order('created_at', { ascending: false });

      if (error) this.handleError(error, 'getAllVideos');
      return data || [];
    } catch (error) {
      this.handleError(error, 'getAllVideos');
    }
  }

  // Получить видео по координатам (в радиусе)
  static async getVideosByLocation(latitude, longitude, radiusKm = 1) {
    try {
      // Используем PostGIS функцию для поиска в радиусе
      const { data, error } = await supabase
        .rpc('get_videos_in_radius', {
          lat: latitude,
          lng: longitude,
          radius: radiusKm
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching videos by location:', error);
      // Fallback: получаем все видео и фильтруем на клиенте
      const allVideos = await this.getAllVideos();
      return allVideos.filter(video => {
        const distance = calculateDistance(
          latitude, longitude,
          video.latitude, video.longitude
        );
        return distance <= radiusKm;
      });
    }
  }

  /**
   * Получить все видео с координатами для отображения на карте
   */
  static async getAllVideosWithCoordinates() {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select(this.VIDEO_SELECT_FIELDS)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('created_at', { ascending: false });

      if (error) this.handleError(error, 'getAllVideosWithCoordinates');
      return data || [];
    } catch (error) {
      this.handleError(error, 'getAllVideosWithCoordinates');
    }
  }

  /**
   * Загрузить видео
   */
  /**
   * Загрузить видео с тегами
   */
  static async uploadVideo(videoData) {
    try {
      // Сначала сохраняем видео без тегов
      const { tags, ...videoDataWithoutTags } = videoData;
      
      const { data, error } = await supabase
        .from('videos')
        .insert([videoDataWithoutTags])
        .select(this.VIDEO_SELECT_FIELDS)
        .maybeSingle();

      if (error) this.handleError(error, 'uploadVideo');
      
      // Если есть теги, добавляем их
      if (data && tags && tags.length > 0) {
        await this.addTagsToVideo(data.id, tags);
      }
      
      return data;
    } catch (error) {
      this.handleError(error, 'uploadVideo');
    }
  }

  /**
   * Добавить теги к видео
   */
  static async addTagsToVideo(videoId, tagNames) {
    try {
      // Получаем или создаем теги
      const tagIds = [];
      
      for (const tagName of tagNames) {
        const tagId = await this.getOrCreateTag(tagName);
        tagIds.push(tagId);
      }
      
      // Создаем связи между видео и тегами
      const videoTags = tagIds.map(tagId => ({
        video_id: videoId,
        tag_id: tagId
      }));
      
      const { error } = await supabase
        .from('video_tags')
        .insert(videoTags);
        
      if (error) this.handleError(error, 'addTagsToVideo');
    } catch (error) {
      this.handleError(error, 'addTagsToVideo');
    }
  }

  /**
   * Получить или создать тег
   */
  static async getOrCreateTag(tagName) {
    try {
      // Сначала пытаемся найти существующий тег по имени
      const { data: existingTag, error: selectError } = await supabase
        .from('tags')
        .select('id')
        .eq('name', tagName)
        .maybeSingle();
        
      if (selectError) this.handleError(selectError, 'getOrCreateTag');
      
      if (existingTag) {
        // Пока просто возвращаем ID, счетчик можно обновить позже
        return existingTag.id;
      }
      
      // Создаем новый тег
      const { data: newTag, error: insertError } = await supabase
        .from('tags')
        .insert([{
          name: tagName,
          usage_count: 1,
          created_at: new Date().toISOString()
        }])
        .select('id')
        .maybeSingle();
        
      if (insertError) this.handleError(insertError, 'getOrCreateTag');
      
      return newTag.id;
    } catch (error) {
      this.handleError(error, 'getOrCreateTag');
    }
  }

  /**
   * Загрузить файл в Storage
   */
  static async uploadVideoFile(file, userId, videoId) {
    try {
      const fileName = `${userId}/${videoId}/${file.name}`;
      
      const { data, error } = await supabase.storage
        .from('geoclips-videos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        // Обработка специфических ошибок Storage
        if (error.message?.includes('File size exceeds') || 
            error.message?.includes('PayloadTooLarge')) {
          throw new Error('Файл слишком большой (лимит: 50MB)');
        }
        this.handleError(error, 'uploadVideoFile');
      }

      return data;
    } catch (error) {
      this.handleError(error, 'uploadVideoFile');
    }
  }

  // Получить публичный URL видео
  static getVideoUrl(filePath) {
    const { data } = supabase.storage
      .from('geoclips-videos')
      .getPublicUrl(filePath);
    return data.publicUrl;
  }

  // Удалить видео
  static async deleteVideo(videoId, userId) {
    try {
      // Удаляем файл из Storage
      const { data: video } = await supabase
        .from('videos')
        .select('video_url')
        .eq('id', videoId)
        .eq('user_id', userId)
        .single();

      if (video?.video_url) {
        const filePath = video.video_url.replace(/^.*\/geoclips-videos\//, '');
        await supabase.storage
          .from('geoclips-videos')
          .remove([filePath]);
      }

      // Удаляем запись из БД
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting video:', error);
      throw error;
    }
  }

  // Лайкнуть видео
  static async likeVideo(videoId, userId) {
    try {
      const { data, error } = await supabase
        .from('likes')
        .insert([{ video_id: videoId, user_id: userId }])
        .select('id, video_id, user_id, created_at')
        .maybeSingle(); // Используем maybeSingle вместо single

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error liking video:', error);
      throw error;
    }
  }

  // Убрать лайк
  static async unlikeVideo(videoId, userId) {
    try {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('video_id', videoId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error unliking video:', error);
      throw error;
    }
  }

  // Проверить, лайкнул ли пользователь видео
  static async isVideoLiked(videoId, userId) {
    try {
      const { data, error } = await supabase
        .from('likes')
        .select('id')
        .eq('video_id', videoId)
        .eq('user_id', userId)
        .maybeSingle(); // Используем maybeSingle вместо single

      return !error && data !== null;
    } catch (error) {
      return false;
    }
  }


  /**
   * Получить видео по ID
   */
  static async getVideoById(videoId) {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select(this.VIDEO_SELECT_FIELDS)
        .eq('id', videoId)
        .maybeSingle();

      if (error) this.handleError(error, 'getVideoById');
      return data;
    } catch (error) {
      this.handleError(error, 'getVideoById');
    }
  }

  /**
   * Получить теги для видео
   */
  static async getVideoTags(videoId) {
    try {
      const { data, error } = await supabase
        .from('video_tags')
        .select(`
          tags (
            id,
            name,
            slug,
            usage_count
          )
        `)
        .eq('video_id', videoId);

      if (error) this.handleError(error, 'getVideoTags');
      
      return data?.map(item => item.tags) || [];
    } catch (error) {
      this.handleError(error, 'getVideoTags');
    }
  }

  // Получить все теги из базы данных
  static async getAllTags() {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, usage_count, created_at')
        .order('usage_count', { ascending: false })
        .order('name');

      if (error) {
        console.error('❌ Ошибка при получении тегов:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Ошибка при получении тегов:', error);
      throw error;
    }
  }

  // Получить пользователя по ID
  static async getUserById(userId) {
    try {
      console.log('🔍 VideoService: Получаем пользователя по ID:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .select('id, yandex_id, display_name, avatar_url, first_name, last_name, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Ошибка при получении пользователя по ID:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching user by ID:', error);
      throw error;
    }
  }
}
