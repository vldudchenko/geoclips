/**
 * Функции для работы с тегами в БД
 */

const supabase = require('../../config/supabase');
const logger = require('../logger');

/**
 * Получить теги для видео и подсчитать их использование
 * @param {string[]} videoIds - массив ID видео
 * @returns {Object} объект с количеством использования для каждого тега
 */
async function getTagCountsByVideos(videoIds) {
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
}

/**
 * Получить или создать тег по названию
 * @param {string} tagName - имя тега
 * @param {string} userId - ID пользователя-создателя
 * @returns {Object} объект с id и name тега
 */
async function getOrCreateTag(tagName, userId = null) {
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
}

/**
 * Привязать теги к видео
 * @param {string} videoId - ID видео
 * @param {string[]} tagNames - массив имен тегов
 * @param {string} userId - ID пользователя-создателя тегов
 * @returns {Object} результат операции
 */
async function assignTagsToVideo(videoId, tagNames, userId = null) {
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
        // Получаем или создаем тег
        const tag = await getOrCreateTag(tagName, userId);
        const isNewTag = !tag.id; // Если id нет, значит только что создали
        
        if (isNewTag) {
          created++;
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
}

/**
 * Получить теги видео
 * @param {string} videoId - ID видео
 * @returns {Array} массив тегов видео
 */
async function getVideoTags(videoId) {
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
}

/**
 * Обновить счетчики использования тегов
 * @param {string[]} tagIds - массив ID тегов (опционально, если не указан - обновляет все теги)
 * @param {boolean} recalculate - пересчитать счетчики из БД
 * @returns {Object} результат операции
 */
async function updateTagCounters(tagIds = null, recalculate = true) {
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
}

/**
 * Удалить теги и их связи с видео
 * @param {string|string[]} tagIds - ID или массив ID тегов для удаления
 * @returns {Object} результат операции
 */
async function deleteTagsWithCleanup(tagIds) {
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

        // 2. Удаляем связи из video_tags
        if (connectionsCount && connectionsCount > 0) {
          logger.info('DB', 'Найдено связей для удаления', { tagId, connections: connectionsCount });
          deletedConnections += connectionsCount;
          
          const { error: deleteConnectionsError } = await supabase
            .from('video_tags')
            .delete()
            .eq('tag_id', tagId);

          if (deleteConnectionsError) {
            logger.error('DB', 'Ошибка удаления связей video_tags', { tagId, error: deleteConnectionsError });
            errors.push(`Связи тега ${tagId}: ${deleteConnectionsError.message}`);
            continue;
          }

          logger.success('DB', 'Связи тега удалены из video_tags', { tagId, deletedConnections: connectionsCount });
        }

        // 3. Удаляем сам тег
        const { error: deleteTagError } = await supabase
          .from('tags')
          .delete()
          .eq('id', tagId);

        if (deleteTagError) {
          logger.error('DB', 'Ошибка удаления тега из tags', { tagId, error: deleteTagError });
          errors.push(`Тег ${tagId}: ${deleteTagError.message}`);
          continue;
        }

        deletedCount++;
        logger.success('DB', 'Тег успешно удален из tags', { tagId });

      } catch (error) {
        logger.error('DB', 'Исключение при удалении тега', { tagId, error: error.message });
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
    logger.error('DB', 'Ошибка в deleteTagsWithCleanup', { error: error.message });
    throw error;
  }
}

/**
 * Получить теги видео для админки с информацией о создателе
 * @param {string} videoId - ID видео
 * @returns {Promise<Object>} результат с тегами и ошибкой
 */
async function getVideoTagsForAdmin(videoId) {
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

    // Обогащаем данные тегов
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
        assigned_by: 'Система'
      };
    }).filter(Boolean);

    return { tags: enrichedTags, error: null };
  } catch (error) {
    logger.error('DB', 'Ошибка получения тегов видео для админки', error);
    return { tags: [], error };
  }
}

module.exports = {
  getTagCountsByVideos,
  getOrCreateTag,
  assignTagsToVideo,
  getVideoTags,
  updateTagCounters,
  deleteTagsWithCleanup,
  getVideoTagsForAdmin
};

