/**
 * Утилиты для работы с базой данных
 * Централизованные функции для часто используемых операций
 */

const supabase = require('../config/supabase');
const logger = require('./logger');

/**
 * Получить счетчик видео для пользователей
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством видео для каждого пользователя
 */
const getVideoCountsByUsers = async (userIds) => {
  if (!userIds || userIds.length === 0) return {};

  try {
    const { data: videoCounts, error } = await supabase
      .from('videos')
      .select('user_id')
      .in('user_id', userIds);

    if (error) {
      logger.error('DB', 'Ошибка получения счетчиков видео', error);
      return {};
    }

    return videoCounts?.reduce((acc, video) => {
      acc[video.user_id] = (acc[video.user_id] || 0) + 1;
      return acc;
    }, {}) || {};
  } catch (error) {
    logger.error('DB', 'Ошибка в getVideoCountsByUsers', error);
    return {};
  }
};

/**
 * Получить теги для видео и подсчитать их использование
 * @param {string[]} videoIds - массив ID видео
 * @returns {Object} объект с количеством использования для каждого тега
 */
const getTagCountsByVideos = async (videoIds) => {
  if (!videoIds || videoIds.length === 0) return {};

  try {
    const { data: videoTags, error } = await supabase
      .from('video_tags')
      .select('tag_id')
      .in('video_id', videoIds);

    if (error) {
      logger.error('DB', 'Ошибка получения тегов видео', error);
      return {};
    }

    return videoTags?.reduce((acc, vt) => {
      acc[vt.tag_id] = (acc[vt.tag_id] || 0) + 1;
      return acc;
    }, {}) || {};
  } catch (error) {
    logger.error('DB', 'Ошибка в getTagCountsByVideos', error);
    return {};
  }
};

/**
 * Удалить видео и обновить счетчики тегов
 * @param {string|string[]} videoIds - ID или массив ID видео для удаления
 * @returns {Object} результат операции
 */
const deleteVideosWithTagCleanup = async (videoIds) => {
  const ids = Array.isArray(videoIds) ? videoIds : [videoIds];
  
  if (ids.length === 0) {
    return { success: true, deletedCount: 0, updatedTags: 0 };
  }

  try {
    // Получаем все теги, связанные с этими видео
    const tagCounts = await getTagCountsByVideos(ids);
    
    // Удаляем связи видео-теги
    const { error: tagsError } = await supabase
      .from('video_tags')
      .delete()
      .in('video_id', ids);

    if (tagsError) {
      logger.warn('DB', 'Ошибка удаления связей видео-теги', tagsError);
    }

    // Обновляем счетчики тегов
    const tagIds = Object.keys(tagCounts);
    let updatedTagCount = 0;

    if (tagIds.length > 0) {
      for (const tagId of tagIds) {
        const { data: tag, error: tagError } = await supabase
          .from('tags')
          .select('usage_count')
          .eq('id', tagId)
          .single();

        if (!tagError && tag) {
          const newCount = Math.max(0, (tag.usage_count || 0) - tagCounts[tagId]);
          const { error: updateError } = await supabase
            .from('tags')
            .update({ usage_count: newCount })
            .eq('id', tagId);

          if (!updateError) {
            updatedTagCount++;
          }
        }
      }
    }

    // Удаляем сами видео
    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .in('id', ids);

    if (deleteError) {
      logger.error('DB', 'Ошибка удаления видео', deleteError);
      throw deleteError;
    }

    logger.success('DB', 'Видео удалены и теги обновлены', {
      videoCount: ids.length,
      tagsUpdated: updatedTagCount
    });

    return {
      success: true,
      deletedCount: ids.length,
      updatedTags: updatedTagCount
    };
  } catch (error) {
    logger.error('DB', 'Ошибка в deleteVideosWithTagCleanup', error);
    throw error;
  }
};

/**
 * Обновить счетчики использования тегов
 * @param {string[]} tagIds - массив ID тегов (опционально, если не указан - обновляет все теги)
 * @param {boolean} recalculate - пересчитать счетчики из БД
 * @returns {Object} результат операции
 */
const updateTagCounters = async (tagIds = null, recalculate = true) => {
  try {
    let tagsToUpdate = [];
    
    if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      // Обновляем только указанные теги
      const { data: tags, error: selectError } = await supabase
        .from('tags')
        .select('id')
        .in('id', tagIds);
      
      if (selectError) {
        logger.error('DB', 'Ошибка получения тегов для обновления', selectError);
        return { success: false, updatedCount: 0, results: [] };
      }
      
      tagsToUpdate = tags || [];
    } else {
      // Обновляем все теги
      const { data: allTags, error: selectError } = await supabase
        .from('tags')
        .select('id');
      
      if (selectError) {
        logger.error('DB', 'Ошибка получения всех тегов', selectError);
        return { success: false, updatedCount: 0, results: [] };
      }
      
      tagsToUpdate = allTags || [];
    }

    if (tagsToUpdate.length === 0) {
      return { success: true, updatedCount: 0, results: [] };
    }

    let updatedCount = 0;
    const results = [];

    for (const tag of tagsToUpdate) {
      const tagId = tag.id;
      
      if (!recalculate) {
        continue; // Пропускаем, если не нужно пересчитывать
      }

      // Пересчитываем из БД
      const { count, error } = await supabase
        .from('video_tags')
        .select('*', { count: 'exact', head: true })
        .eq('tag_id', tagId);

      if (error) {
        logger.error('DB', 'Ошибка подсчета использования тега', { tagId, error });
        continue;
      }

      const newCount = count || 0;

      const { error: updateError } = await supabase
        .from('tags')
        .update({ usage_count: newCount })
        .eq('id', tagId);

      if (!updateError) {
        updatedCount++;
        results.push({ tagId, newCount });
        logger.info('DB', 'Счетчик тега обновлен', { tagId, newCount });
      } else {
        logger.error('DB', 'Ошибка обновления счетчика тега', { tagId, error: updateError });
      }
    }

    logger.info('DB', 'Счетчики тегов обновлены', { total: tagsToUpdate.length, updated: updatedCount });
    return { success: true, updatedCount, results };
  } catch (error) {
    logger.error('DB', 'Ошибка в updateTagCounters', error);
    throw error;
  }
};

/**
 * Удалить теги и их связи с видео
 * @param {string|string[]} tagIds - ID или массив ID тегов для удаления
 * @returns {Object} результат операции
 */
const deleteTagsWithCleanup = async (tagIds) => {
  const ids = Array.isArray(tagIds) ? tagIds : [tagIds];

  if (ids.length === 0) {
    return { success: true, deletedCount: 0, deletedConnections: 0 };
  }

  try {
    let deletedConnections = 0;
    let deletedCount = 0;
    const errors = [];

    for (const tagId of ids) {
      try {
        // 1. Подсчитываем связи video_tags по tag_id
        const { count: connectionsCount, error: countError } = await supabase
          .from('video_tags')
          .select('*', { count: 'exact', head: true })
          .eq('tag_id', tagId);

        if (countError) {
          logger.warn('DB', 'Ошибка подсчета связей', { tagId, error: countError });
        }

        // 2. Если есть связи, удаляем их из video_tags
        if (connectionsCount && connectionsCount > 0) {
          logger.info('DB', 'Найдено связей для удаления', { tagId, connections: connectionsCount });
          deletedConnections += connectionsCount;

          logger.info('DB', 'Начинаем удаление связей', { tagId });
          
          const { error: deleteConnectionsError } = await supabase
            .from('video_tags')
            .delete()
            .eq('tag_id', tagId);

          if (deleteConnectionsError) {
            logger.error('DB', 'Ошибка удаления связей video_tags', { 
              tagId, 
              error: deleteConnectionsError,
              message: deleteConnectionsError.message,
              code: deleteConnectionsError.code
            });
            errors.push(`Связи тега ${tagId}: ${deleteConnectionsError.message}`);
            continue;
          }

          logger.success('DB', 'Связи тега удалены из video_tags', { 
            tagId, 
            deletedConnections: connectionsCount
          });
        } else {
          logger.info('DB', 'Нет связей для удаления', { tagId });
        }

        // 3. Удаляем сам тег по id из таблицы tags
        logger.info('DB', 'Начинаем удаление тега', { tagId });
        
        // Проверяем, что тег существует перед удалением
        const { data: tagToDelete, error: checkError } = await supabase
          .from('tags')
          .select('id, name, usage_count')
          .eq('id', tagId)
          .maybeSingle();

        if (checkError) {
          logger.error('DB', 'Ошибка проверки существования тега', { 
            tagId, 
            error: checkError.message,
            code: checkError.code
          });
          errors.push(`Проверка тега ${tagId}: ${checkError.message}`);
          continue;
        }

        if (!tagToDelete) {
          logger.warn('DB', 'Тег не найден при удалении', { tagId });
          errors.push(`Тег ${tagId} не найден`);
          continue;
        }

        logger.info('DB', 'Найден тег для удаления', { 
          tagId, 
          name: tagToDelete.name,
          usage_count: tagToDelete.usage_count 
        });

        const { error: deleteTagError, count: deletedRowsCount } = await supabase
          .from('tags')
          .delete()
          .eq('id', tagId);

        if (deleteTagError) {
          logger.error('DB', 'Ошибка удаления тега из tags', { 
            tagId, 
            error: deleteTagError,
            message: deleteTagError.message,
            code: deleteTagError.code,
            hint: deleteTagError.hint
          });
          errors.push(`Тег ${tagId}: ${deleteTagError.message}`);
          continue;
        }

        deletedCount++;
        logger.success('DB', 'Тег успешно удален из tags', { 
          tagId, 
          name: tagToDelete.name,
          deletedRows: deletedRowsCount 
        });

      } catch (error) {
        logger.error('DB', 'Исключение при удалении тега', { 
          tagId, 
          error: error.message,
          stack: error.stack
        });
        errors.push(`Тег ${tagId}: ${error.message}`);
      }
    }

    logger.success('DB', 'Удаление тегов завершено', { 
      total: ids.length, 
      deleted: deletedCount, 
      connections: deletedConnections,
      errors: errors.length 
    });

    return { 
      success: deletedCount > 0, 
      deletedCount, 
      deletedConnections,
      errors: errors.length > 0 ? errors : undefined 
    };
  } catch (error) {
    logger.error('DB', 'Ошибка в deleteTagsWithCleanup', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Обработчик ошибок БД для стандартизированного ответа
 * @param {Object} error - объект ошибки Supabase
 * @param {string} operation - название операции
 * @param {string} defaultMessage - сообщение по умолчанию
 * @returns {Object} стандартизированный объект ошибки
 */
const handleDbError = (error, operation = 'Database operation', defaultMessage = 'Database error') => {
  logger.error('DB', `Ошибка ${operation}`, error);
  
  return {
    code: error.code || 'DB_ERROR',
    message: error.message || defaultMessage,
    details: error.details || null
  };
};

/**
 * Получить или создать тег по названию
 * @param {string} tagName - имя тега
 * @param {string} userId - ID пользователя-создателя
 * @returns {Object} объект с id и name тега
 */
const getOrCreateTag = async (tagName, userId = null) => {
  if (!tagName || typeof tagName !== 'string' || tagName.trim().length === 0) {
    throw new Error('Имя тега не может быть пустым');
  }

  const normalizedName = tagName.trim().toLowerCase();

  try {
    // Пытаемся найти существующий тег
    const { data: existingTag, error: selectError } = await supabase
      .from('tags')
      .select('id, name, usage_count, user_id')
      .ilike('name', normalizedName)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      logger.error('DB', 'Ошибка поиска тега', { tagName: normalizedName, error: selectError });
      throw selectError;
    }

    if (existingTag) {
      logger.info('DB', 'Тег найден', { id: existingTag.id, name: existingTag.name, user_id: existingTag.user_id });
      return existingTag;
    }

    // Создаем новый тег
    logger.info('DB', 'Создаем новый тег', { name: normalizedName, user_id: userId });

    const { data: newTag, error: insertError } = await supabase
      .from('tags')
      .insert([{ name: normalizedName, usage_count: 0, user_id: userId }])
      .select('id, name, usage_count, user_id')
      .single();

    if (insertError) {
      logger.error('DB', 'Ошибка создания тега', { tagName: normalizedName, error: insertError });
      throw insertError;
    }

    logger.success('DB', 'Тег успешно создан', { id: newTag.id, name: newTag.name, user_id: newTag.user_id });
    return newTag;
  } catch (error) {
    logger.error('DB', 'Ошибка в getOrCreateTag', { tagName: normalizedName, error: error.message });
    throw error;
  }
};

/**
 * Привязать теги к видео
 * @param {string} videoId - ID видео
 * @param {string[]} tagNames - массив имен тегов
 * @param {string} userId - ID пользователя-создателя тегов
 * @returns {Object} результат операции
 */
const assignTagsToVideo = async (videoId, tagNames, userId = null) => {
  if (!videoId || !Array.isArray(tagNames) || tagNames.length === 0) {
    return { success: true, created: 0, assigned: 0, skipped: 0 };
  }

  try {
    let created = 0;
    let assigned = 0;
    let skipped = 0;
    const errors = [];

    logger.info('DB', 'Начинаем привязку тегов к видео', { videoId, tagCount: tagNames.length });

    for (const tagName of tagNames) {
      try {
        // Проверяем, существует ли тег с таким именем
        const normalizedName = tagName.trim().toLowerCase();
        const { data: existingTag, error: selectError } = await supabase
          .from('tags')
          .select('id, name, usage_count, user_id')
          .ilike('name', normalizedName)
          .maybeSingle();

        let tag;
        let isNewTag = false;

        if (selectError && selectError.code !== 'PGRST116') {
          logger.warn('DB', 'Ошибка поиска тега', { tagName: normalizedName, error: selectError });
          errors.push(`${tagName}: ${selectError.message}`);
          continue;
        }

        if (existingTag) {
          tag = existingTag;
          logger.info('DB', 'Тег найден', { id: tag.id, name: tag.name });
        } else {
          // Создаем новый тег
          logger.info('DB', 'Создаем новый тег', { name: normalizedName, user_id: userId });
          
          const { data: newTag, error: insertError } = await supabase
            .from('tags')
            .insert([{ name: normalizedName, usage_count: 0, user_id: userId }])
            .select('id, name, usage_count, user_id')
            .single();

          if (insertError) {
            logger.error('DB', 'Ошибка создания тега', { tagName: normalizedName, error: insertError });
            errors.push(`${tagName}: ${insertError.message}`);
            continue;
          }

          tag = newTag;
          isNewTag = true;
          created++;
          logger.success('DB', 'Тег успешно создан', { id: tag.id, name: tag.name });
        }

        // Проверяем, не привязан ли уже этот тег к видео
        const { data: existingLink, error: checkError } = await supabase
          .from('video_tags')
          .select('id')
          .eq('video_id', videoId)
          .eq('tag_id', tag.id)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          logger.warn('DB', 'Ошибка проверки привязки тега', { videoId, tagId: tag.id, error: checkError });
          errors.push(`${tagName}: ${checkError.message}`);
          continue;
        }

        if (existingLink) {
          logger.info('DB', 'Тег уже привязан к видео', { videoId, tagId: tag.id, tagName });
          skipped++;
          continue;
        }

        // Привязываем тег к видео
        const { error: insertLinkError } = await supabase
          .from('video_tags')
          .insert([{ video_id: videoId, tag_id: tag.id }]);

        if (insertLinkError) {
          logger.error('DB', 'Ошибка привязки тега к видео', { videoId, tagId: tag.id, error: insertLinkError });
          errors.push(`${tagName}: ${insertLinkError.message}`);
          continue;
        }

        // Увеличиваем счетчик использования тега
        const { error: updateError } = await supabase
          .from('tags')
          .update({ usage_count: (tag.usage_count || 0) + 1 })
          .eq('id', tag.id);

        if (updateError) {
          logger.warn('DB', 'Ошибка обновления счетчика тега', { tagId: tag.id, error: updateError });
        }

        assigned++;
        logger.success('DB', 'Тег привязан к видео', { videoId, tagId: tag.id, tagName, isNewTag });

      } catch (error) {
        logger.error('DB', 'Ошибка при обработке тега', { tagName, error: error.message });
        errors.push(`${tagName}: ${error.message}`);
      }
    }

    logger.success('DB', 'Привязка тегов завершена', {
      videoId,
      created,
      assigned,
      skipped,
      errors: errors.length
    });

    return {
      success: assigned > 0 || skipped > 0,
      created,
      assigned,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    logger.error('DB', 'Ошибка в assignTagsToVideo', { videoId, error: error.message });
    throw error;
  }
};

/**
 * Получить теги видео
 * @param {string} videoId - ID видео
 * @returns {Array} массив тегов видео
 */
const getVideoTags = async (videoId) => {
  if (!videoId) return [];

  try {
    const { data: videoTags, error } = await supabase
      .from('video_tags')
      .select('tag_id, tags(id, name, usage_count, user_id)')
      .eq('video_id', videoId);

    if (error) {
      logger.error('DB', 'Ошибка получения тегов видео', { videoId, error });
      return [];
    }

    const tags = (videoTags || []).map(vt => vt.tags).filter(Boolean);
    logger.info('DB', 'Получены теги видео');

    return tags;
  } catch (error) {
    logger.error('DB', 'Ошибка в getVideoTags', { videoId, error: error.message });
    return [];
  }
};

/**
 * Получить комментарии для видео
 * @param {string} videoId - ID видео
 * @param {Object} options - опции запроса (limit, offset, sortBy, order)
 * @returns {Object} комментарии и общее количество
 */
const getVideoComments = async (videoId, options = {}) => {
  const { limit = 50, offset = 0, sortBy = 'created_at', order = 'desc' } = options;

  if (!videoId) {
    return { comments: [], total: 0 };
  }

  try {
    const { data: comments, error, count } = await supabase
      .from('comments')
      .select(`
        id,
        text,
        created_at,
        users (
          id,
          display_name,
          avatar_url
        )
      `, { count: 'exact' })
      .eq('video_id', videoId)
      .order(sortBy, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('DB', 'Ошибка получения комментариев видео', { videoId, error });
      throw error;
    }

    return {
      comments: comments || [],
      total: count || 0
    };
  } catch (error) {
    logger.error('DB', 'Ошибка в getVideoComments', { videoId, error: error.message });
    throw error;
  }
};

/**
 * Получить статистику по комментариям
 * @returns {Object} статистика комментариев
 */
const getCommentsStats = async () => {
  try {
    // Общее количество комментариев
    const { count: totalComments, error: totalError } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true });

    if (totalError) {
      logger.error('DB', 'Ошибка получения общего количества комментариев', totalError);
    }

    // Комментарии за последние 24 часа
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentComments, error: recentError } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', yesterday);

    if (recentError) {
      logger.error('DB', 'Ошибка получения количества недавних комментариев', recentError);
    }

    // Топ видео по комментариям
    const { data: topVideos, error: topError } = await supabase
      .from('videos')
      .select('id, description, comments_count')
      .order('comments_count', { ascending: false })
      .limit(10);

    if (topError) {
      logger.error('DB', 'Ошибка получения топ видео по комментариям', topError);
    }

    // Топ комментаторы
    const { data: topCommenters, error: commentersError } = await supabase
      .rpc('get_top_commenters', { limit_count: 10 })
      .select('*');

    if (commentersError) {
      logger.warn('DB', 'Ошибка получения топ комментаторов (возможно, функция не создана)', commentersError);
    }

    return {
      totalComments: totalComments || 0,
      recentComments: recentComments || 0,
      topVideos: topVideos || [],
      topCommenters: topCommenters || []
    };
  } catch (error) {
    logger.error('DB', 'Ошибка в getCommentsStats', { error: error.message });
    return {
      totalComments: 0,
      recentComments: 0,
      topVideos: [],
      topCommenters: []
    };
  }
};

/**
 * Удалить комментарии видео
 * @param {string} videoId - ID видео
 * @returns {Object} результат операции
 */
const deleteVideoComments = async (videoId) => {
  if (!videoId) {
    return { success: false, deleted: 0 };
  }

  try {
    const { count, error } = await supabase
      .from('comments')
      .delete({ count: 'exact' })
      .eq('video_id', videoId);

    if (error) {
      logger.error('DB', 'Ошибка удаления комментариев видео', { videoId, error });
      throw error;
    }

    logger.success('DB', 'Комментарии видео удалены', { videoId, deleted: count });

    return {
      success: true,
      deleted: count || 0
    };
  } catch (error) {
    logger.error('DB', 'Ошибка в deleteVideoComments', { videoId, error: error.message });
    throw error;
  }
};

/**
 * Удалить комментарии пользователя
 * @param {string} userId - ID пользователя
 * @returns {Object} результат операции
 */
const deleteUserComments = async (userId) => {
  if (!userId) {
    return { success: false, deleted: 0 };
  }

  try {
    const { count, error } = await supabase
      .from('comments')
      .delete({ count: 'exact' })
      .eq('user_id', userId);

    if (error) {
      logger.error('DB', 'Ошибка удаления комментариев пользователя', { userId, error });
      throw error;
    }

    logger.success('DB', 'Комментарии пользователя удалены', { userId, deleted: count });

    return {
      success: true,
      deleted: count || 0
    };
  } catch (error) {
    logger.error('DB', 'Ошибка в deleteUserComments', { userId, error: error.message });
    throw error;
  }
};

module.exports = {
  getVideoCountsByUsers,
  getTagCountsByVideos,
  deleteVideosWithTagCleanup,
  updateTagCounters,
  deleteTagsWithCleanup,
  handleDbError,
  getOrCreateTag,
  assignTagsToVideo,
  getVideoTags,
  getVideoComments,
  getCommentsStats,
  deleteVideoComments,
  deleteUserComments
};
