/**
 * Роуты для работы с лайками (админ-панель)
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/unified');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const apiResponse = require('../middleware/apiResponse');

/**
 * Получение лайков поставленных пользователем
 */
router.get('/given/:userId', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  try {
    const { data: likes, error } = await supabase
      .from('likes')
      .select(`
        id,
        created_at,
        video_id,
        videos!inner(
          id,
          description,
          user_id
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('ADMIN', 'Ошибка получения поставленных лайков', error);
      return apiResponse.sendError(res, error, {
        statusCode: 500,
        code: 'DB_ERROR',
        operation: 'получение поставленных лайков'
      });
    }

    const processedLikes = likes?.map(like => ({
      id: like.id,
      created_at: like.created_at,
      video_id: like.video_id,
      video_description: like.videos?.description || 'Без описания'
    })) || [];

    apiResponse.sendSuccess(res, { likes: processedLikes });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка в получении поставленных лайков', error);
    apiResponse.sendError(res, 'Ошибка сервера', {
      statusCode: 500,
      code: 'SERVER_ERROR'
    });
  }
}));

/**
 * Получение лайков полученных пользователем (лайки его видео)
 */
router.get('/received/:userId', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  try {
    // Сначала получаем видео пользователя
    const { data: userVideos, error: videosError } = await supabase
      .from('videos')
      .select('id')
      .eq('user_id', userId);

    if (videosError) {
      logger.error('ADMIN', 'Ошибка получения видео пользователя', videosError);
      return apiResponse.sendError(res, videosError, {
        statusCode: 500,
        code: 'DB_ERROR',
        operation: 'получение видео пользователя'
      });
    }

    logger.info('ADMIN', 'Видео пользователя найдены', {
      userId,
      videosCount: userVideos?.length || 0,
      videoIds: userVideos?.map(v => v.id) || []
    });

    if (!userVideos || userVideos.length === 0) {
      return apiResponse.sendSuccess(res, { likes: [] });
    }

    const videoIds = userVideos.map(video => video.id);

    // Получаем лайки к этим видео с информацией о пользователях
    const { data: likes, error } = await supabase
      .from('likes')
      .select(`
        id,
        created_at,
        video_id,
        user_id,
        videos!inner(
          id,
          description
        ),
        users(
          id,
          display_name,
          avatar_url
        )
      `)
      .in('video_id', videoIds)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('ADMIN', 'Ошибка получения полученных лайков', error);
      return apiResponse.sendError(res, error, {
        statusCode: 500,
        code: 'DB_ERROR',
        operation: 'получение полученных лайков'
      });
    }

    logger.info('ADMIN', 'Получены лайки с данными пользователей', {
      likesCount: likes?.length || 0,
      sampleLike: likes?.[0] ? {
        id: likes[0].id,
        user_id: likes[0].user_id,
        user_name: likes[0].users?.display_name,
        user_avatar: likes[0].users?.avatar_url
      } : null
    });

    const processedLikes = likes?.map(like => ({
      id: like.id,
      created_at: like.created_at,
      video_id: like.video_id,
      video_description: like.videos?.description || 'Без описания',
      user_id: like.user_id,
      user_name: like.users?.display_name || 'Неизвестный пользователь',
      user_avatar: like.users?.avatar_url || null
    })) || [];

    apiResponse.sendSuccess(res, { likes: processedLikes });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка в получении полученных лайков', error);
    apiResponse.sendError(res, 'Ошибка сервера', {
      statusCode: 500,
      code: 'SERVER_ERROR'
    });
  }
}));

module.exports = router;
