/**
 * Маршруты для работы с комментариями
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const apiResponse = require('../middleware/apiResponse');
const { requireAuth, requireAdmin } = require('../middleware/unified');
const logger = require('../utils/logger');
const dbUtils = require('../utils/dbUtils');

/**
 * Добавляет поле is_edited к комментарию
 * @param {Object} comment - комментарий
 * @returns {Object} - комментарий с добавленным полем is_edited
 */
function enrichComment(comment) {
  if (!comment) return comment;
  
  // Проверяем, был ли комментарий отредактирован
  // Разница больше 1 секунды между created_at и updated_at
  const createdAt = new Date(comment.created_at);
  const updatedAt = new Date(comment.updated_at);
  const isEdited = (updatedAt - createdAt) > 1000;
  
  return {
    ...comment,
    is_edited: isEdited
  };
}

/**
 * Обрабатывает массив комментариев, добавляя поле is_edited
 * @param {Array} comments - массив комментариев
 * @returns {Array} - массив комментариев с добавленным полем is_edited
 */
function enrichComments(comments) {
  if (!Array.isArray(comments)) return comments;
  return comments.map(enrichComment);
}

/**
 * Получить комментарии для видео
 * GET /api/comments/video/:videoId
 */
router.get('/video/:videoId', apiResponse.asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { limit = 50, offset = 0, sortBy = 'created_at', order = 'desc' } = req.query;

  try {
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        id,
        text,
        created_at,
        updated_at,
        users (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('video_id', videoId)
      .order(sortBy, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('COMMENTS', 'Ошибка получения комментариев', error);
      return apiResponse.sendError(res, 'Ошибка получения комментариев', {
        statusCode: 500,
        code: 'DATABASE_ERROR'
      });
    }

    // Получаем актуальный счетчик комментариев из таблицы videos
    const { data: videoData, error: videoCountError } = await supabase
      .from('videos')
      .select('comments_count')
      .eq('id', videoId)
      .single();

    if (videoCountError) {
      logger.warn('COMMENTS', 'Ошибка получения счетчика комментариев', videoCountError);
    }

    // Обогащаем комментарии полем is_edited
    const enrichedComments = enrichComments(comments);

    apiResponse.sendSuccess(res, {
      comments: enrichedComments,
      total: videoData?.comments_count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('COMMENTS', 'Ошибка получения комментариев', error);
    apiResponse.sendError(res, 'Ошибка получения комментариев', {
      statusCode: 500,
      code: 'INTERNAL_ERROR'
    });
  }
}));

/**
 * Добавить комментарий к видео
 * POST /api/comments/video/:videoId
 */
router.post('/video/:videoId', requireAuth, apiResponse.asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { text } = req.body;
  const userId = req.user?.dbUser?.id;

  if (!userId) {
    return apiResponse.sendError(res, 'Пользователь не авторизован', {
      statusCode: 401,
      code: 'UNAUTHORIZED'
    });
  }

  if (!text || text.trim().length === 0) {
    return apiResponse.sendError(res, 'Текст комментария не может быть пустым', {
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
  }

  if (text.length > 1000) {
    return apiResponse.sendError(res, 'Комментарий не может быть длиннее 1000 символов', {
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
  }

  try {
    // Проверяем, что видео существует
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return apiResponse.sendError(res, 'Видео не найдено', {
        statusCode: 404,
        code: 'NOT_FOUND'
      });
    }

    // Создаем комментарий
    const { data: insertedComment, error: insertError } = await supabase
      .from('comments')
      .insert([{
        video_id: videoId,
        user_id: userId,
        text: text.trim()
      }])
      .select('id')
      .single();

    if (insertError) {
      logger.error('COMMENTS', 'Ошибка создания комментария', insertError);
      return apiResponse.sendError(res, 'Ошибка создания комментария', {
        statusCode: 500,
        code: 'DATABASE_ERROR'
      });
    }

    // Получаем полные данные комментария с пользователем
    const { data: comment, error: selectError } = await supabase
      .from('comments')
      .select(`
        id,
        text,
        created_at,
        updated_at,
        users (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('id', insertedComment.id)
      .single();

    if (selectError) {
      logger.error('COMMENTS', 'Ошибка получения данных комментария', selectError);
      return apiResponse.sendError(res, 'Ошибка получения данных комментария', {
        statusCode: 500,
        code: 'DATABASE_ERROR'
      });
    }

    // Получаем актуальный счетчик комментариев после создания
    const { data: videoData, error: videoCreateError } = await supabase
      .from('videos')
      .select('comments_count')
      .eq('id', videoId)
      .single();

    if (videoCreateError) {
      logger.warn('COMMENTS', 'Ошибка получения счетчика комментариев', videoCreateError);
    }

    logger.success('COMMENTS', 'Комментарий создан', { 
      commentId: comment.id, 
      videoId, 
      userId,
      commentsCount: videoData?.comments_count || 0
    });

    // Обогащаем комментарий полем is_edited
    const enrichedComment = enrichComment(comment);

    apiResponse.sendSuccess(res, { 
      comment: enrichedComment,
      commentsCount: videoData?.comments_count || 0
    }, { statusCode: 201 });
  } catch (error) {
    logger.error('COMMENTS', 'Ошибка создания комментария', error);
    apiResponse.sendError(res, 'Ошибка создания комментария', {
      statusCode: 500,
      code: 'INTERNAL_ERROR'
    });
  }
}));

/**
 * Обновить комментарий (только автор)
 * PUT /api/comments/:commentId
 */
router.put('/:commentId', requireAuth, apiResponse.asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { text } = req.body;
  const userId = req.user?.dbUser?.id;

  if (!userId) {
    return apiResponse.sendError(res, 'Пользователь не авторизован', {
      statusCode: 401,
      code: 'UNAUTHORIZED'
    });
  }

  if (!text || text.trim().length === 0) {
    return apiResponse.sendError(res, 'Текст комментария не может быть пустым', {
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
  }

  if (text.length > 1000) {
    return apiResponse.sendError(res, 'Комментарий не может быть длиннее 1000 символов', {
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    });
  }

  try {
    // Проверяем, что комментарий существует и принадлежит пользователю
    const { data: comment, error: selectError } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (selectError || !comment) {
      return apiResponse.sendError(res, 'Комментарий не найден', {
        statusCode: 404,
        code: 'NOT_FOUND'
      });
    }

    if (comment.user_id !== userId) {
      return apiResponse.sendError(res, 'Недостаточно прав для редактирования комментария', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    // Обновляем комментарий
    const { data: updatedComment, error: updateError } = await supabase
      .from('comments')
      .update({ text: text.trim() })
      .eq('id', commentId)
      .select(`
        id,
        text,
        created_at,
        updated_at,
        users (
          id,
          display_name,
          avatar_url
        )
      `)
      .single();

    if (updateError) {
      logger.error('COMMENTS', 'Ошибка обновления комментария', updateError);
      return apiResponse.sendError(res, 'Ошибка обновления комментария', {
        statusCode: 500,
        code: 'DATABASE_ERROR'
      });
    }

    logger.success('COMMENTS', 'Комментарий обновлен', { commentId, userId });

    // Обогащаем комментарий полем is_edited
    const enrichedComment = enrichComment(updatedComment);

    apiResponse.sendSuccess(res, { comment: enrichedComment });
  } catch (error) {
    logger.error('COMMENTS', 'Ошибка обновления комментария', error);
    apiResponse.sendError(res, 'Ошибка обновления комментария', {
      statusCode: 500,
      code: 'INTERNAL_ERROR'
    });
  }
}));

/**
 * Удалить комментарий (автор или админ)
 * DELETE /api/comments/:commentId
 */
router.delete('/:commentId', requireAuth, apiResponse.asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?.dbUser?.id;
  const isAdmin = req.user?.isAdmin;

  if (!userId) {
    return apiResponse.sendError(res, 'Пользователь не авторизован', {
      statusCode: 401,
      code: 'UNAUTHORIZED'
    });
  }

  try {
    // Проверяем, что комментарий существует
    const { data: comment, error: selectError } = await supabase
      .from('comments')
      .select('user_id, video_id')
      .eq('id', commentId)
      .single();

    if (selectError || !comment) {
      return apiResponse.sendError(res, 'Комментарий не найден', {
        statusCode: 404,
        code: 'NOT_FOUND'
      });
    }

    // Проверяем права (автор или админ)
    if (comment.user_id !== userId && !isAdmin) {
      return apiResponse.sendError(res, 'Недостаточно прав для удаления комментария', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    // Удаляем комментарий
    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      logger.error('COMMENTS', 'Ошибка удаления комментария', deleteError);
      return apiResponse.sendError(res, 'Ошибка удаления комментария', {
        statusCode: 500,
        code: 'DATABASE_ERROR'
      });
    }

    // Получаем актуальный счетчик комментариев после удаления
    const { data: videoData, error: videoDeleteError } = await supabase
      .from('videos')
      .select('comments_count')
      .eq('id', comment.video_id)
      .single();

    if (videoDeleteError) {
      logger.warn('COMMENTS', 'Ошибка получения счетчика комментариев', videoDeleteError);
    }

    logger.success('COMMENTS', 'Комментарий удален', { 
      commentId, 
      userId, 
      isAdmin,
      commentsCount: videoData?.comments_count || 0
    });

    apiResponse.sendSuccess(res, { 
      message: 'Комментарий удален',
      commentId,
      commentsCount: videoData?.comments_count || 0
    });
  } catch (error) {
    logger.error('COMMENTS', 'Ошибка удаления комментария', error);
    apiResponse.sendError(res, 'Ошибка удаления комментария', {
      statusCode: 500,
      code: 'INTERNAL_ERROR'
    });
  }
}));

/**
 * Получить все комментарии (для админ-панели)
 * GET /api/comments/admin/all
 */
router.get('/admin/all', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { limit = 100, offset = 0, sortBy = 'created_at', order = 'desc', videoId } = req.query;

  try {
    let query = supabase
      .from('comments')
      .select(`
        id,
        text,
        created_at,
        updated_at,
        users (
          id,
          display_name,
          avatar_url
        ),
        videos (
          id,
          description,
          user_id
        )
      `, { count: 'exact' })
      .order(sortBy, { ascending: order === 'asc' });

    // Фильтрация по видео (если указано)
    if (videoId) {
      query = query.eq('video_id', videoId);
    }

    const { data: comments, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('COMMENTS', 'Ошибка получения всех комментариев', error);
      return apiResponse.sendError(res, 'Ошибка получения комментариев', {
        statusCode: 500,
        code: 'DATABASE_ERROR'
      });
    }

    // Обогащаем комментарии полем is_edited
    const enrichedComments = enrichComments(comments);

    apiResponse.sendSuccess(res, {
      comments: enrichedComments,
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('COMMENTS', 'Ошибка получения всех комментариев', error);
    apiResponse.sendError(res, 'Ошибка получения комментариев', {
      statusCode: 500,
      code: 'INTERNAL_ERROR'
    });
  }
}));

/**
 * Удалить комментарий администратором
 * DELETE /api/comments/admin/:commentId
 */
router.delete('/admin/:commentId', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  try {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      logger.error('COMMENTS', 'Ошибка удаления комментария администратором', error);
      return apiResponse.sendError(res, 'Ошибка удаления комментария', {
        statusCode: 500,
        code: 'DATABASE_ERROR'
      });
    }

    logger.success('COMMENTS', 'Комментарий удален администратором', { commentId });

    apiResponse.sendSuccess(res, {
      message: 'Комментарий удален',
      commentId
    });
  } catch (error) {
    logger.error('COMMENTS', 'Ошибка удаления комментария администратором', error);
    apiResponse.sendError(res, 'Ошибка удаления комментария', {
      statusCode: 500,
      code: 'INTERNAL_ERROR'
    });
  }
}));

/**
 * Получение комментариев пользователя (написанных)
 */
router.get('/user/:userId', requireAdmin, apiResponse.asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  try {
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        id,
        text,
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
      logger.error('ADMIN', 'Ошибка получения комментариев пользователя', error);
      return apiResponse.sendError(res, error, {
        statusCode: 500,
        code: 'DB_ERROR',
        operation: 'получение комментариев пользователя'
      });
    }

    const processedComments = comments?.map(comment => ({
      id: comment.id,
      text: comment.text,
      created_at: comment.created_at,
      video_id: comment.video_id,
      video_description: comment.videos?.description || 'Без описания'
    })) || [];

    apiResponse.sendSuccess(res, { comments: processedComments });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка в получении комментариев пользователя', error);
    apiResponse.sendError(res, 'Ошибка сервера', {
      statusCode: 500,
      code: 'SERVER_ERROR'
    });
  }
}));

/**
 * Получение комментариев полученных пользователем (к его видео)
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

    if (!userVideos || userVideos.length === 0) {
      return apiResponse.sendSuccess(res, { comments: [] });
    }

    const videoIds = userVideos.map(video => video.id);

    // Получаем комментарии к этим видео
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        id,
        text,
        created_at,
        video_id,
        videos!inner(
          id,
          description
        )
      `)
      .in('video_id', videoIds)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('ADMIN', 'Ошибка получения полученных комментариев', error);
      return apiResponse.sendError(res, error, {
        statusCode: 500,
        code: 'DB_ERROR',
        operation: 'получение полученных комментариев'
      });
    }

    const processedComments = comments?.map(comment => ({
      id: comment.id,
      text: comment.text,
      created_at: comment.created_at,
      video_id: comment.video_id,
      video_description: comment.videos?.description || 'Без описания'
    })) || [];

    apiResponse.sendSuccess(res, { comments: processedComments });
  } catch (error) {
    logger.error('ADMIN', 'Ошибка в получении полученных комментариев', error);
    apiResponse.sendError(res, 'Ошибка сервера', {
      statusCode: 500,
      code: 'SERVER_ERROR'
    });
  }
}));

module.exports = router;

