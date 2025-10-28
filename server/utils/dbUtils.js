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
    logger.info('DB', 'Получаем видео пользователей', { userIds: userIds.slice(0, 3) });
    
    const { data: videoCounts, error } = await supabase
      .from('videos')
      .select('user_id')
      .in('user_id', userIds);

    if (error) {
      logger.error('DB', 'Ошибка получения счетчиков видео', error);
      return {};
    }

    logger.info('DB', 'Найдено видео', { count: videoCounts?.length || 0 });

    const result = videoCounts?.reduce((acc, video) => {
      acc[video.user_id] = (acc[video.user_id] || 0) + 1;
      return acc;
    }, {}) || {};

    logger.info('DB', 'Результат видео по пользователям', result);
    return result;
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
          .insert([{ video_id: videoId, tag_id: tag.id, assigned_by: userId }]);

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
      .select(`
        tag_id, 
        assigned_by,
        tags(id, name, usage_count, user_id),
        assigned_user:assigned_by(display_name)
      `)
      .eq('video_id', videoId);

    if (error) {
      logger.error('DB', 'Ошибка получения тегов видео', { videoId, error });
      return [];
    }

    // Получаем информацию о создателях тегов
    const tagIds = [...new Set(videoTags?.map(vt => vt.tags?.id).filter(Boolean))];
    let creatorsMap = {};
    
    if (tagIds.length > 0) {
      const { data: creators, error: creatorsError } = await supabase
        .from('users')
        .select('id, display_name')
        .in('id', tagIds.map(tagId => {
          const tag = videoTags.find(vt => vt.tags?.id === tagId);
          return tag?.tags?.user_id;
        }).filter(Boolean));
      
      if (!creatorsError && creators) {
        creatorsMap = creators.reduce((map, creator) => {
          map[creator.id] = creator.display_name;
          return map;
        }, {});
      }
    }

    const tags = (videoTags || []).map(vt => ({
      ...vt.tags,
      assigned_by: vt.assigned_by,
      assigned_by_name: vt.assigned_user?.display_name || 'Система',
      creator_name: vt.tags?.user_id ? creatorsMap[vt.tags.user_id] || 'Неизвестно' : 'Система'
    })).filter(tag => tag.id);

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

/**
 * Получить количество комментариев для пользователей
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством комментариев для каждого пользователя
 */
const getCommentsCountsByUsers = async (userIds) => {
  if (!userIds || userIds.length === 0) return {};

  try {
    const { data: commentCounts, error } = await supabase
      .from('comments')
      .select('user_id')
      .in('user_id', userIds);

    if (error) {
      logger.error('DB', 'Ошибка получения счетчиков комментариев', error);
      return {};
    }

    return commentCounts?.reduce((acc, comment) => {
      acc[comment.user_id] = (acc[comment.user_id] || 0) + 1;
      return acc;
    }, {}) || {};
  } catch (error) {
    logger.error('DB', 'Ошибка в getCommentsCountsByUsers', error);
    return {};
  }
};

/**
 * Получить количество комментариев написанных пользователями
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством написанных комментариев для каждого пользователя
 */
const getCommentsWrittenByUsers = async (userIds) => {
  if (!userIds || userIds.length === 0) return {};

  try {
    logger.info('DB', 'Получаем комментарии пользователей', { userIds: userIds.slice(0, 3) });
    
    const { data: commentsWritten, error } = await supabase
      .from('comments')
      .select('user_id')
      .in('user_id', userIds);

    if (error) {
      logger.error('DB', 'Ошибка получения написанных комментариев', error);
      return {};
    }

    logger.info('DB', 'Найдено комментариев', { count: commentsWritten?.length || 0 });

    const result = commentsWritten?.reduce((acc, comment) => {
      const userId = comment.user_id;
      acc[userId] = (acc[userId] || 0) + 1;
      return acc;
    }, {}) || {};

    logger.info('DB', 'Результат комментариев по пользователям', result);
    return result;
  } catch (error) {
    logger.error('DB', 'Ошибка в getCommentsWrittenByUsers', error);
    return {};
  }
};

/**
 * Получить количество комментариев полученных пользователями (комментарии к их видео)
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством полученных комментариев для каждого пользователя
 */
const getCommentsReceivedByUsers = async (userIds) => {
  if (!userIds || userIds.length === 0) return {};

  try {
    // Получаем видео пользователей
    const { data: userVideos, error: videosError } = await supabase
      .from('videos')
      .select('id, user_id')
      .in('user_id', userIds);

    if (videosError) {
      logger.error('DB', 'Ошибка получения видео пользователей', videosError);
      return {};
    }

    if (!userVideos || userVideos.length === 0) {
      return {};
    }

    const videoIds = userVideos.map(video => video.id);

    // Получаем комментарии к этим видео
    const { data: videoComments, error: commentsError } = await supabase
      .from('comments')
      .select('video_id')
      .in('video_id', videoIds);

    if (commentsError) {
      logger.error('DB', 'Ошибка получения комментариев к видео', commentsError);
      return {};
    }

    // Создаем мапу video_id -> user_id
    const videoToUser = {};
    userVideos.forEach(video => {
      videoToUser[video.id] = video.user_id;
    });

    // Подсчитываем комментарии по пользователям
    return videoComments?.reduce((acc, comment) => {
      const userId = videoToUser[comment.video_id];
      if (userId) {
        acc[userId] = (acc[userId] || 0) + 1;
      }
      return acc;
    }, {}) || {};
  } catch (error) {
    logger.error('DB', 'Ошибка в getCommentsReceivedByUsers', error);
    return {};
  }
};

/**
 * Получить количество лайков для пользователей (сумма лайков их видео)
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством лайков для каждого пользователя
 */
const getLikesCountsByUsers = async (userIds) => {
  if (!userIds || userIds.length === 0) return {};

  try {
    const { data: videoLikes, error } = await supabase
      .from('videos')
      .select('user_id, likes_count')
      .in('user_id', userIds);

    if (error) {
      logger.error('DB', 'Ошибка получения счетчиков лайков', error);
      return {};
    }

    return videoLikes?.reduce((acc, video) => {
      const userId = video.user_id;
      acc[userId] = (acc[userId] || 0) + (video.likes_count || 0);
      return acc;
    }, {}) || {};
  } catch (error) {
    logger.error('DB', 'Ошибка в getLikesCountsByUsers', error);
    return {};
  }
};

/**
 * Получить количество лайков поставленных пользователями
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством поставленных лайков для каждого пользователя
 */
const getLikesGivenByUsers = async (userIds) => {
  if (!userIds || userIds.length === 0) return {};

  try {
    logger.info('DB', 'Получаем лайки пользователей', { userIds: userIds.slice(0, 3) });
    
    const { data: likesGiven, error } = await supabase
      .from('likes')
      .select('user_id')
      .in('user_id', userIds);

    if (error) {
      logger.error('DB', 'Ошибка получения поставленных лайков', error);
      return {};
    }

    logger.info('DB', 'Найдено лайков', { count: likesGiven?.length || 0 });

    const result = likesGiven?.reduce((acc, like) => {
      const userId = like.user_id;
      acc[userId] = (acc[userId] || 0) + 1;
      return acc;
    }, {}) || {};

    logger.info('DB', 'Результат лайков по пользователям', result);
    return result;
  } catch (error) {
    logger.error('DB', 'Ошибка в getLikesGivenByUsers', error);
    return {};
  }
};

/**
 * Получить количество лайков полученных пользователями (лайки их видео)
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством полученных лайков для каждого пользователя
 */
const getLikesReceivedByUsers = async (userIds) => {
  if (!userIds || userIds.length === 0) return {};

  try {
    const { data: videoLikes, error } = await supabase
      .from('videos')
      .select('user_id, likes_count')
      .in('user_id', userIds);

    if (error) {
      logger.error('DB', 'Ошибка получения полученных лайков', error);
      return {};
    }

    return videoLikes?.reduce((acc, video) => {
      const userId = video.user_id;
      acc[userId] = (acc[userId] || 0) + (video.likes_count || 0);
      return acc;
    }, {}) || {};
  } catch (error) {
    logger.error('DB', 'Ошибка в getLikesReceivedByUsers', error);
    return {};
  }
};

/**
 * Получить количество созданных тегов для пользователей
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством созданных тегов для каждого пользователя
 */
const getTagsCountsByUsers = async (userIds) => {
  if (!userIds || userIds.length === 0) return {};

  try {
    logger.info('DB', 'Получаем теги пользователей', { userIds: userIds.slice(0, 3) });
    
    const { data: userTags, error } = await supabase
      .from('tags')
      .select('user_id')
      .in('user_id', userIds);

    if (error) {
      logger.error('DB', 'Ошибка получения созданных тегов пользователей', error);
      return {};
    }

    logger.info('DB', 'Найдено тегов', { count: userTags?.length || 0 });

    const result = userTags?.reduce((acc, tag) => {
      const userId = tag.user_id;
      if (userId) {
        acc[userId] = (acc[userId] || 0) + 1;
      }
      return acc;
    }, {}) || {};

    logger.info('DB', 'Результат тегов по пользователям', result);
    return result;
  } catch (error) {
    logger.error('DB', 'Ошибка в getTagsCountsByUsers', error);
    return {};
  }
};

/**
 * Получить количество использованных тегов для пользователей (теги в их видео)
 * @param {string[]} userIds - массив ID пользователей
 * @returns {Object} объект с количеством использованных тегов для каждого пользователя
 */
const getTagsUsedByUsers = async (userIds) => {
  if (!userIds || userIds.length === 0) return {};

  try {
    // Получаем видео пользователей
    const { data: userVideos, error: videosError } = await supabase
      .from('videos')
      .select('id, user_id')
      .in('user_id', userIds);

    if (videosError) {
      logger.error('DB', 'Ошибка получения видео пользователей', videosError);
      return {};
    }

    if (!userVideos || userVideos.length === 0) {
      return {};
    }

    const videoIds = userVideos.map(video => video.id);

    // Получаем теги для этих видео
    const { data: videoTags, error: tagsError } = await supabase
      .from('video_tags')
      .select('video_id')
      .in('video_id', videoIds);

    if (tagsError) {
      logger.error('DB', 'Ошибка получения тегов видео', tagsError);
      return {};
    }

    // Создаем мапу video_id -> user_id
    const videoToUser = {};
    userVideos.forEach(video => {
      videoToUser[video.id] = video.user_id;
    });

    // Подсчитываем теги по пользователям
    return videoTags?.reduce((acc, videoTag) => {
      const userId = videoToUser[videoTag.video_id];
      if (userId) {
        acc[userId] = (acc[userId] || 0) + 1;
      }
      return acc;
    }, {}) || {};
  } catch (error) {
    logger.error('DB', 'Ошибка в getTagsUsedByUsers', error);
    return {};
  }
};

// ==================== ФУНКЦИИ ДЛЯ РАБОТЫ С КОММЕНТАРИЯМИ ====================

/**
 * Получить комментарии для видео
 * @param {string} videoId - ID видео
 * @param {Object} options - опции запроса
 * @returns {Promise<Object>} результат с комментариями и ошибкой
 */
const getCommentsForVideo = async (videoId, options = {}) => {
  try {
    const { limit = 50, offset = 0, sortBy = 'created_at', order = 'desc' } = options;

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
      return { comments: [], total: 0, error };
    }

    // Получаем актуальный счетчик комментариев
    const { data: videoData, error: videoCountError } = await supabase
      .from('videos')
      .select('comments_count')
      .eq('id', videoId)
      .single();

    if (videoCountError) {
      logger.warn('DB', 'Ошибка получения счетчика комментариев', videoCountError);
    }

    return { 
      comments: comments || [], 
      total: videoData?.comments_count || 0,
      error: null 
    };
  } catch (error) {
    logger.error('DB', 'Ошибка получения комментариев для видео', error);
    return { comments: [], total: 0, error };
  }
};

/**
 * Создать комментарий к видео
 * @param {string} videoId - ID видео
 * @param {string} userId - ID пользователя
 * @param {string} text - текст комментария
 * @returns {Promise<Object>} результат операции
 */
const createCommentForVideo = async (videoId, userId, text) => {
  try {
    // Проверяем, что видео существует
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return { success: false, error: 'Видео не найдено' };
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
      logger.error('DB', 'Ошибка создания комментария', insertError);
      return { success: false, error: insertError };
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
      logger.error('DB', 'Ошибка получения данных комментария', selectError);
      return { success: false, error: selectError };
    }

    return { success: true, comment };
  } catch (error) {
    logger.error('DB', 'Ошибка создания комментария', error);
    return { success: false, error };
  }
};

/**
 * Получить все комментарии для админки
 * @param {Object} filters - фильтры
 * @returns {Promise<Object>} результат с комментариями и ошибкой
 */
const getAllCommentsForAdmin = async (filters = {}) => {
  try {
    const { limit = 100, offset = 0, sortBy = 'created_at', order = 'desc', videoId } = filters;

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

    return { comments: comments || [], total: count || 0, error };
  } catch (error) {
    logger.error('DB', 'Ошибка получения всех комментариев для админки', error);
    return { comments: [], total: 0, error };
  }
};

/**
 * Получить комментарии пользователя (написанные)
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} результат с комментариями и ошибкой
 */
const getCommentsWrittenByUser = async (userId) => {
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
      return { comments: [], error };
    }

    const processedComments = comments?.map(comment => ({
      id: comment.id,
      text: comment.text,
      created_at: comment.created_at,
      video_id: comment.video_id,
      video_description: comment.videos?.description || 'Без описания'
    })) || [];

    return { comments: processedComments, error: null };
  } catch (error) {
    logger.error('DB', 'Ошибка получения написанных комментариев пользователя', error);
    return { comments: [], error };
  }
};

/**
 * Получить комментарии полученные пользователем (к его видео)
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} результат с комментариями и ошибкой
 */
const getCommentsReceivedByUser = async (userId) => {
  try {
    // Сначала получаем видео пользователя
    const { data: userVideos, error: videosError } = await supabase
      .from('videos')
      .select('id')
      .eq('user_id', userId);

    if (videosError) {
      return { comments: [], error: videosError };
    }

    if (!userVideos || userVideos.length === 0) {
      return { comments: [], error: null };
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
      return { comments: [], error };
    }

    const processedComments = comments?.map(comment => ({
      id: comment.id,
      text: comment.text,
      created_at: comment.created_at,
      video_id: comment.video_id,
      video_description: comment.videos?.description || 'Без описания'
    })) || [];

    return { comments: processedComments, error: null };
  } catch (error) {
    logger.error('DB', 'Ошибка получения полученных комментариев пользователя', error);
    return { comments: [], error };
  }
};

// ==================== ФУНКЦИИ ДЛЯ РАБОТЫ С ЛАЙКАМИ ====================

/**
 * Получить лайки поставленные пользователем
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} результат с лайками и ошибкой
 */
const getLikesGivenByUser = async (userId) => {
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
      return { likes: [], error };
    }

    const processedLikes = likes?.map(like => ({
      id: like.id,
      created_at: like.created_at,
      video_id: like.video_id,
      video_description: like.videos?.description || 'Без описания'
    })) || [];

    return { likes: processedLikes, error: null };
  } catch (error) {
    logger.error('DB', 'Ошибка получения поставленных лайков пользователя', error);
    return { likes: [], error };
  }
};

/**
 * Получить лайки полученные пользователем (лайки его видео)
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} результат с лайками и ошибкой
 */
const getLikesReceivedByUser = async (userId) => {
  try {
    // Сначала получаем видео пользователя
    const { data: userVideos, error: videosError } = await supabase
      .from('videos')
      .select('id')
      .eq('user_id', userId);

    if (videosError) {
      return { likes: [], error: videosError };
    }

    if (!userVideos || userVideos.length === 0) {
      return { likes: [], error: null };
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
      return { likes: [], error };
    }

    const processedLikes = likes?.map(like => ({
      id: like.id,
      created_at: like.created_at,
      video_id: like.video_id,
      video_description: like.videos?.description || 'Без описания',
      user_id: like.user_id,
      user_name: like.users?.display_name || 'Неизвестный пользователь',
      user_avatar: like.users?.avatar_url || null
    })) || [];

    return { likes: processedLikes, error: null };
  } catch (error) {
    logger.error('DB', 'Ошибка получения полученных лайков пользователя', error);
    return { likes: [], error };
  }
};

// ==================== ФУНКЦИИ ДЛЯ РАБОТЫ С ВИДЕО ====================

/**
 * Получить все видео для админки
 * @returns {Promise<Object>} результат с видео и ошибкой
 */
const getAllVideosForAdmin = async () => {
  try {
    const { data: videos, error } = await supabase
      .from('videos')
      .select(`
        id, user_id, description, video_url,
        latitude, longitude, likes_count, views_count, comments_count,
        created_at,
        users (id, yandex_id, display_name, avatar_url)
      `)
      .order('created_at', { ascending: false });

    return { videos: videos || [], error };
  } catch (error) {
    logger.error('DB', 'Ошибка получения всех видео для админки', error);
    return { videos: [], error };
  }
};

/**
 * Поиск видео с фильтрацией для админки
 * @param {Object} filters - фильтры поиска
 * @returns {Promise<Object>} результат с видео, количеством и ошибкой
 */
const searchVideosForAdmin = async (filters = {}) => {
  try {
    const {
      query,
      userId,
      sortBy = 'created_at',
      order = 'desc',
      limit = 50,
      offset = 0,
      minViews,
      minLikes
    } = filters;

    let queryBuilder = supabase.from('videos').select(`
      id, user_id, description, video_url, latitude, longitude,
      likes_count, views_count, comments_count, created_at,
      users (id, yandex_id, display_name, avatar_url)
    `, { count: 'exact' });

    // Применяем фильтры
    if (query) {
      queryBuilder = queryBuilder.ilike('description', `%${query}%`);
    }
    if (userId) {
      queryBuilder = queryBuilder.eq('user_id', userId);
    }
    if (minViews) {
      queryBuilder = queryBuilder.gte('views_count', parseInt(minViews));
    }
    if (minLikes) {
      queryBuilder = queryBuilder.gte('likes_count', parseInt(minLikes));
    }

    // Сортировка и пагинация
    const ascending = order === 'asc';
    queryBuilder = queryBuilder
      .order(sortBy, { ascending })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: videos, error, count } = await queryBuilder;

    return { videos: videos || [], count: count || 0, error };
  } catch (error) {
    logger.error('DB', 'Ошибка поиска видео для админки', error);
    return { videos: [], count: 0, error };
  }
};

/**
 * Получить лайки видео для админки
 * @param {string} videoId - ID видео
 * @returns {Promise<Object>} результат с лайками и ошибкой
 */
const getVideoLikesForAdmin = async (videoId) => {
  try {
    const { data: likes, error } = await supabase
      .from('likes')
      .select(`
        id,
        created_at,
        users (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    return { likes: likes || [], error };
  } catch (error) {
    logger.error('DB', 'Ошибка получения лайков видео для админки', error);
    return { likes: [], error };
  }
};

/**
 * Исправить счетчики просмотров для всех видео
 * Пересчитывает views_count на основе реальных записей в video_views
 * @returns {Promise<Object>} результат операции
 */
const fixVideoViewsCounters = async () => {
  try {
    logger.info('DB', 'Начинаем исправление счетчиков просмотров');
    
    // Получаем все видео
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('id, views_count');
    
    if (videosError) {
      logger.error('DB', 'Ошибка получения списка видео', videosError);
      return { success: false, error: videosError };
    }
    
    let fixedCount = 0;
    const results = [];
    
    for (const video of videos) {
      // Получаем реальное количество просмотров из таблицы video_views
      const { count: realViewsCount, error: countError } = await supabase
        .from('video_views')
        .select('*', { count: 'exact', head: true })
        .eq('video_id', video.id);
      
      if (countError) {
        logger.error('DB', 'Ошибка подсчета просмотров для видео', { videoId: video.id, error: countError });
        continue;
      }
      
      const realCount = realViewsCount || 0;
      const currentCount = video.views_count || 0;
      
      // Если счетчики не совпадают, обновляем
      if (realCount !== currentCount) {
        const { error: updateError } = await supabase
          .from('videos')
          .update({ views_count: realCount })
          .eq('id', video.id);
        
        if (updateError) {
          logger.error('DB', 'Ошибка обновления счетчика просмотров', { videoId: video.id, error: updateError });
          continue;
        }
        
        fixedCount++;
        results.push({
          videoId: video.id,
          oldCount: currentCount,
          newCount: realCount
        });
        
        logger.info('DB', 'Счетчик просмотров исправлен', { 
          videoId: video.id, 
          oldCount: currentCount, 
          newCount: realCount 
        });
      }
    }
    
    logger.info('DB', 'Исправление счетчиков просмотров завершено', { 
      totalVideos: videos.length, 
      fixedCount, 
      results: results.slice(0, 5) // Показываем только первые 5 результатов
    });
    
    return { success: true, fixedCount, totalVideos: videos.length, results };
  } catch (error) {
    logger.error('DB', 'Ошибка в fixVideoViewsCounters', error);
    return { success: false, error };
  }
};

/**
 * Обновить счетчик просмотров видео
 * @param {string} videoId - ID видео
 * @returns {Promise<Object>} результат операции
 */
const updateVideoViewsCount = async (videoId) => {
  try {
    // Получаем текущий счетчик
    const { data: currentVideo, error: getCurrentError } = await supabase
      .from('videos')
      .select('views_count')
      .eq('id', videoId)
      .single();

    if (getCurrentError) {
      logger.error('DB', 'Ошибка получения текущего счетчика просмотров', getCurrentError);
      return { success: false, error: getCurrentError };
    }

    // Увеличиваем счетчик на 1
    const { error: updateError } = await supabase
      .from('videos')
      .update({ views_count: (currentVideo.views_count || 0) + 1 })
      .eq('id', videoId);

    if (updateError) {
      logger.error('DB', 'Ошибка обновления счетчика просмотров', updateError);
      return { success: false, error: updateError };
    }

    logger.info('DB', 'Счетчик просмотров обновлен', { videoId, newCount: (currentVideo.views_count || 0) + 1 });
    return { success: true, newCount: (currentVideo.views_count || 0) + 1 };
  } catch (error) {
    logger.error('DB', 'Ошибка в updateVideoViewsCount', error);
    return { success: false, error };
  }
};

/**
 * Получить просмотры видео для админки
 * @param {string} videoId - ID видео
 * @returns {Promise<Object>} результат с информацией о просмотрах и ошибкой
 */
const getVideoViewsForAdmin = async (videoId) => {
  try {
    // Получаем список пользователей, которые просмотрели видео
    const { data: views, error } = await supabase
      .from('video_views')
      .select(`
        id,
        created_at,
        users (
          id,
          display_name,
          avatar_url,
          yandex_id
        )
      `)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    if (error) {
      return { views: [], error };
    }

    // Получаем общее количество просмотров
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('views_count, description')
      .eq('id', videoId)
      .single();

    if (videoError) {
      return { views: [], error: videoError };
    }

    // Формируем результат
    const result = {
      total_views: video.views_count || 0,
      video_description: video.description || 'Без описания',
      viewers: views?.map(view => ({
        id: view.id,
        viewed_at: view.created_at,
        user: view.users ? {
          id: view.users.id,
          display_name: view.users.display_name || 'Неизвестно',
          avatar_url: view.users.avatar_url,
          yandex_id: view.users.yandex_id
        } : null
      })).filter(view => view.user) || []
    };

    return { views: [result], error: null };
  } catch (error) {
    logger.error('DB', 'Ошибка получения просмотров видео для админки', error);
    return { views: [], error };
  }
};

/**
 * Получить комментарии видео для админки
 * @param {string} videoId - ID видео
 * @returns {Promise<Object>} результат с комментариями и ошибкой
 */
const getVideoCommentsForAdmin = async (videoId) => {
  try {
    const { data: comments, error } = await supabase
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
      `)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    return { comments: comments || [], error };
  } catch (error) {
    logger.error('DB', 'Ошибка получения комментариев видео для админки', error);
    return { comments: [], error };
  }
};

/**
 * Получить теги видео для админки с информацией о создателе
 * @param {string} videoId - ID видео
 * @returns {Promise<Object>} результат с тегами и ошибкой
 */
const getVideoTagsForAdmin = async (videoId) => {
  try {
    const { data: videoTags, error } = await supabase
      .from('video_tags')
      .select(`
        video_id,
        tag_id,
        created_at,
        tags (
          id,
          name,
          usage_count,
          user_id,
          created_at,
          users!tags_user_id_fkey (
            id,
            display_name,
            avatar_url
          )
        )
      `)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    if (error) {
      return { tags: [], error };
    }

    // Обогащаем данные тегов информацией о создателе и том, кто присвоил тег
    const enrichedTags = videoTags.map(vt => {
      const tag = vt.tags;
      if (!tag) return null;

      return {
        id: tag.id,
        name: tag.name,
        usage_count: tag.usage_count,
        created_at: tag.created_at,
        creator: tag.users ? {
          id: tag.users.id,
          display_name: tag.users.display_name,
          avatar_url: tag.users.avatar_url
        } : null,
        assigned_at: vt.created_at,
        assigned_by: 'Система' // Пока что не отслеживаем, кто именно присвоил тег
      };
    }).filter(Boolean);

    return { tags: enrichedTags, error: null };
  } catch (error) {
    logger.error('DB', 'Ошибка получения тегов видео для админки', error);
    return { tags: [], error };
  }
};

/**
 * Удалить видео администратором
 * @param {string} videoId - ID видео
 * @returns {Promise<Object>} результат операции
 */
const deleteVideoForAdmin = async (videoId) => {
  try {
    const result = await deleteVideosWithTagCleanup(videoId);
    return { success: true, ...result };
  } catch (error) {
    logger.error('DB', 'Ошибка удаления видео администратором', error);
    return { success: false, error };
  }
};

/**
 * Массовое удаление видео администратором
 * @param {string[]} videoIds - массив ID видео
 * @returns {Promise<Object>} результат операции
 */
const bulkDeleteVideosForAdmin = async (videoIds) => {
  try {
    const result = await deleteVideosWithTagCleanup(videoIds);
    return { success: true, ...result };
  } catch (error) {
    logger.error('DB', 'Ошибка массового удаления видео администратором', error);
    return { success: false, error };
  }
};

/**
 * Обновить теги видео администратором
 * @param {string} videoId - ID видео
 * @param {string[]} tagNames - массив названий тегов
 * @param {string} userId - ID пользователя (опционально)
 * @returns {Promise<Object>} результат операции
 */
const updateVideoTagsForAdmin = async (videoId, tagNames, userId = null) => {
  try {
    // Удаляем старые теги
    const { error: deleteError } = await supabase
      .from('video_tags')
      .delete()
      .eq('video_id', videoId);

    if (deleteError) {
      logger.error('DB', 'Ошибка удаления старых тегов', deleteError);
      return { success: false, error: deleteError };
    }

    // Добавляем новые теги
    if (tagNames && tagNames.length > 0) {
      const result = await assignTagsToVideo(videoId, tagNames, userId);
      if (!result.success) {
        return result;
      }
    }

    return { success: true };
  } catch (error) {
    logger.error('DB', 'Ошибка обновления тегов видео администратором', error);
    return { success: false, error };
  }
};

module.exports = {
  getVideoCountsByUsers,
  getCommentsCountsByUsers,
  getCommentsWrittenByUsers,
  getCommentsReceivedByUsers,
  getLikesCountsByUsers,
  getLikesGivenByUsers,
  getLikesReceivedByUsers,
  getTagsCountsByUsers,
  getTagsUsedByUsers,
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
  deleteUserComments,
  // Новые функции для работы с комментариями
  getCommentsForVideo,
  createCommentForVideo,
  getAllCommentsForAdmin,
  getCommentsWrittenByUser,
  getCommentsReceivedByUser,
  // Новые функции для работы с лайками
  getLikesGivenByUser,
  getLikesReceivedByUser,
  // Новые функции для работы с видео
  getAllVideosForAdmin,
  searchVideosForAdmin,
  getVideoLikesForAdmin,
  getVideoViewsForAdmin,
  getVideoCommentsForAdmin,
  getVideoTagsForAdmin,
  deleteVideoForAdmin,
  bulkDeleteVideosForAdmin,
  updateVideoTagsForAdmin,
  updateVideoViewsCount,
  fixVideoViewsCounters
};
