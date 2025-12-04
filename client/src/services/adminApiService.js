/**
 * Сервис для работы с административным API
 * Централизованные запросы для админ-панели
 */

import { SERVER_URL } from '../utils/constants';

class AdminApiService {
  /**
   * Базовый метод для выполнения запросов к API
   */
  static async apiRequest(endpoint, options = {}) {
    try {
      const url = `${SERVER_URL}/api${endpoint}`;
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`AdminApiService Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // ==================== ПРОВЕРКА ДОСТУПА ====================

  /**
   * Проверить права администратора
   */
  static async checkAdminAccess() {
    try {
      const response = await this.apiRequest('/admin/check-access');
      return response.isAdmin === true;
    } catch (error) {
      console.error('Ошибка проверки прав администратора:', error);
      return false;
    }
  }

  // ==================== ДАШБОРД ====================

  /**
   * Получить статистику для дашборда
   */
  static async getDashboardStats() {
    const response = await this.apiRequest('/admin/dashboard/stats');
    return response.data || response;
  }

  /**
   * Получить последние активности
   */
  static async getRecentActivities(limit = 10) {
    const response = await this.apiRequest(`/admin/dashboard/activities?limit=${limit}`);
    return response.data || response;
  }

  // ==================== ПОЛЬЗОВАТЕЛИ ====================

  /**
   * Получить список пользователей
   */
  static async getUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await this.apiRequest(`/users?${queryString}`);
    return response.users || response.data || response;
  }

  /**
   * Поиск пользователей
   */
  static async searchUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await this.apiRequest(`/users/search?${queryString}`);
    return response.data || response;
  }

  /**
   * Получить пользователя по ID
   */
  static async getUserById(userId) {
    const response = await this.apiRequest(`/users/${userId}`);
    return response.user || response.data || response;
  }

  /**
   * Удалить пользователя
   */
  static async deleteUser(userId) {
    const response = await this.apiRequest(`/users/${userId}`, {
      method: 'DELETE',
    });
    return response.data || response;
  }

  /**
   * Получить видео пользователя
   */
  static async getUserVideos(userId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await this.apiRequest(`/users/${userId}/videos?${queryString}`);
    return response.videos || response.data || response;
  }

  /**
   * Получить комментарии пользователя (написанные)
   */
  static async getUserComments(userId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await this.apiRequest(`/comments/user/${userId}?${queryString}`);
    return response.comments || response.data || response;
  }

  /**
   * Получить комментарии полученные пользователем
   */
  static async getUserReceivedComments(userId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await this.apiRequest(`/comments/received/${userId}?${queryString}`);
    return response.comments || response.data || response;
  }

  // ==================== ВИДЕО ====================

  /**
   * Получить список видео
   */
  static async getVideos(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await this.apiRequest(`/video/admin?${queryString}`);
    return response.videos || response.data || response;
  }

  /**
   * Поиск видео
   */
  static async searchVideos(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await this.apiRequest(`/video/admin/search?${queryString}`);
    return response.videos || response.data || response;
  }

  /**
   * Получить видео по ID
   */
  static async getVideoById(videoId) {
    const response = await this.apiRequest(`/video/${videoId}`);
    return response.video || response.data || response;
  }

  /**
   * Удалить видео
   */
  static async deleteVideo(videoId) {
    const response = await this.apiRequest(`/video/admin/${videoId}`, {
      method: 'DELETE',
    });
    return response.data || response;
  }

  /**
   * Массовое удаление видео
   */
  static async deleteVideos(videoIds) {
    const response = await this.apiRequest('/video/admin/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ videoIds }),
    });
    return response.data || response;
  }

  /**
   * Получить теги видео
   */
  static async getVideoTags(videoId) {
    const response = await this.apiRequest(`/video/${videoId}/tags`);
    return response.tags || response.data || response;
  }

  /**
   * Обновить теги видео
   */
  static async updateVideoTags(videoId, tagIds) {
    const response = await this.apiRequest(`/video/${videoId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tagIds }),
    });
    return response.data || response;
  }

  /**
   * Получить комментарии видео
   */
  static async getVideoComments(videoId) {
    const response = await this.apiRequest(`/video/${videoId}/comments`);
    return response.comments || response.data || response;
  }

  /**
   * Получить лайки видео
   */
  static async getVideoLikes(videoId) {
    const response = await this.apiRequest(`/video/${videoId}/likes`);
    return response.likes || response.data || response;
  }

  /**
   * Получить просмотры видео
   */
  static async getVideoViews(videoId) {
    const response = await this.apiRequest(`/video/${videoId}/views`);
    return response.views || response.data || response;
  }

  // ==================== КОММЕНТАРИИ ====================

  /**
   * Получить все комментарии
   */
  static async getComments(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await this.apiRequest(`/comments/admin/all?${queryString}`);
    return response.comments || response.data || response;
  }

  /**
   * Получить комментарий по ID
   */
  static async getCommentById(commentId) {
    const response = await this.apiRequest(`/comments/${commentId}`);
    return response.comment || response.data || response;
  }

  /**
   * Удалить комментарий
   */
  static async deleteComment(commentId) {
    const response = await this.apiRequest(`/comments/admin/${commentId}`, {
      method: 'DELETE',
    });
    return response.data || response;
  }

  // ==================== ТЕГИ ====================

  /**
   * Получить все теги
   */
  static async getTags(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await this.apiRequest(`/tags?${queryString}`);
    return response.tags || response.data || response;
  }

  /**
   * Поиск тегов
   */
  static async searchTags(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await this.apiRequest(`/tags/search?${queryString}`);
    return response.tags || response.data || response;
  }

  /**
   * Получить тег по ID
   */
  static async getTagById(tagId) {
    const response = await this.apiRequest(`/tags/${tagId}`);
    return response.tag || response.data || response;
  }

  /**
   * Создать тег
   */
  static async createTag(tagData) {
    const response = await this.apiRequest('/tags', {
      method: 'POST',
      body: JSON.stringify(tagData),
    });
    return response.tag || response.data || response;
  }

  /**
   * Обновить тег
   */
  static async updateTag(tagId, tagData) {
    const response = await this.apiRequest(`/tags/${tagId}`, {
      method: 'PUT',
      body: JSON.stringify(tagData),
    });
    return response.tag || response.data || response;
  }

  /**
   * Удалить тег
   */
  static async deleteTag(tagId) {
    const response = await this.apiRequest(`/tags/${tagId}`, {
      method: 'DELETE',
    });
    return response.data || response;
  }

  /**
   * Получить видео с тегом
   */
  static async getTagVideos(tagId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await this.apiRequest(`/tags/${tagId}/videos?${queryString}`);
    return response.videos || response.data || response;
  }

  // ==================== УТИЛИТЫ ====================

  /**
   * Исправить счетчики просмотров
   */
  static async fixViewsCounters() {
    const response = await this.apiRequest('/video/admin/fix-views-counters', {
      method: 'POST',
    });
    return response.data || response;
  }

  /**
   * Обновить счетчики тегов
   */
  static async updateTagCounters() {
    const response = await this.apiRequest('/tags/admin/update-counters', {
      method: 'POST',
    });
    return response.data || response;
  }
}

export { AdminApiService };