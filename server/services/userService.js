/**
 * Сервис для работы с пользователями
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { createUserAvatar } = require('./avatarService');

/**
 * Проверка и создание пользователя в базе данных
 */
const ensureUserInDatabase = async (yandexUserData, retryCount = 0) => {
  try {
    logger.info('USER', 'Проверяем пользователя в базе данных', { yandex_id: yandexUserData.id, retry: retryCount });

    // Проверяем, существует ли пользователь
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id, yandex_id, first_name, last_name, display_name, avatar_url')
      .eq('yandex_id', yandexUserData.id)
      .maybeSingle();

    if (selectError) {
      logger.error('USER', 'Ошибка при проверке пользователя', selectError);
      throw selectError;
    }

    if (existingUser) {
      logger.success('USER', 'Пользователь уже существует', { user_id: existingUser.id });
      
      // Проверяем, нужно ли обновить аватар
      let avatarUrl = existingUser.avatar_url;
      
      // Если у пользователя нет аватара в БД, но есть в Yandex - загружаем
      if (!existingUser.avatar_url && yandexUserData.is_avatar_empty === false && yandexUserData.default_avatar_id) {
        logger.info('USER', 'У пользователя нет аватара в БД, загружаем из Yandex', { user_id: existingUser.id });
        try {
          avatarUrl = await createUserAvatar(yandexUserData, existingUser.id);
          logger.success('USER', 'Аватар успешно загружен и сохранен', { user_id: existingUser.id });
        } catch (error) {
          logger.error('USER', 'Ошибка загрузки аватара', { user_id: existingUser.id, error: error.message });
          // Продолжаем без аватара
        }
      }
      
      // Обновляем данные пользователя
      const updateData = {
        first_name: yandexUserData.first_name || existingUser.first_name,
        last_name: yandexUserData.last_name || existingUser.last_name,
        display_name: yandexUserData.display_name || yandexUserData.real_name || existingUser.display_name,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      };

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('yandex_id', yandexUserData.id)
        .select('id, yandex_id, first_name, last_name, display_name, avatar_url')
        .maybeSingle();

      if (updateError) {
        logger.error('USER', 'Ошибка при обновлении пользователя', updateError);
        return existingUser;
      }

      logger.success('USER', 'Данные пользователя обновлены', { user_id: updatedUser.id });
      return updatedUser;
    } else {
      logger.info('USER', 'Создаем/обновляем пользователя через UPSERT');
      
      // Создаем аватар из Яндекс данных, если он есть
      let avatarUrl = null;
      if (yandexUserData.is_avatar_empty === false && yandexUserData.default_avatar_id) {
        try {
          avatarUrl = await createUserAvatar(yandexUserData);
        } catch (error) {
          logger.error('USER', 'Ошибка создания аватара, продолжаем без него', error);
        }
      }
      
      // Используем UPSERT функцию для безопасного создания/обновления пользователя
      const { data: upsertResult, error: upsertError } = await supabase
        .rpc('upsert_user', {
          p_yandex_id: yandexUserData.id,
          p_first_name: yandexUserData.first_name || 'Пользователь',
          p_last_name: yandexUserData.last_name || '',
          p_display_name: yandexUserData.display_name || yandexUserData.real_name || yandexUserData.login,
          p_avatar_url: avatarUrl
        });

      if (upsertError) {
        logger.error('USER', 'Ошибка при UPSERT пользователя', upsertError);
        throw upsertError;
      }

      if (!upsertResult || upsertResult.length === 0) {
        throw new Error('Не удалось создать или получить пользователя');
      }

      const user = upsertResult[0];
      logger.success('USER', 'Пользователь создан/обновлен через UPSERT', { user_id: user.id });
      return user;
    }
  } catch (error) {
    // Если это ошибка дублирования ключа и у нас есть попытки, повторим с задержкой
    if (error.code === '23505' && error.message.includes('users_yandex_id_key') && retryCount < 2) {
      logger.warn('USER', 'Race condition обнаружен, повторяем попытку', { retry: retryCount + 1, yandex_id: yandexUserData.id });
      await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1))); // 100ms, 200ms задержка
      return ensureUserInDatabase(yandexUserData, retryCount + 1);
    }
    
    logger.error('USER', 'Ошибка в ensureUserInDatabase', error);
    throw error;
  }
};

/**
 * Обновление только базовых данных пользователя (без аватара)
 */
const updateUserBasicData = async (yandexUserData) => {
  try {
    logger.loading('USER', 'Обновление базовых данных пользователя', { yandex_id: yandexUserData.id });
    
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id, yandex_id, first_name, last_name, display_name, avatar_url')
      .eq('yandex_id', yandexUserData.id)
      .maybeSingle();

    if (selectError) {
      logger.error('USER', 'Ошибка при получении пользователя', selectError);
      throw selectError;
    }

    if (!existingUser) {
      throw new Error('Пользователь не найден в базе данных');
    }

    const updateData = {
      first_name: yandexUserData.first_name || existingUser.first_name,
      last_name: yandexUserData.last_name || existingUser.last_name,
      display_name: yandexUserData.display_name || yandexUserData.real_name || existingUser.display_name,
      avatar_url: existingUser.avatar_url,
      updated_at: new Date().toISOString()
    };

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', existingUser.id)
      .select('id, yandex_id, first_name, last_name, display_name, avatar_url')
      .maybeSingle();

    if (updateError) {
      logger.error('USER', 'Ошибка обновления базовых данных', updateError);
      throw updateError;
    }

    logger.success('USER', 'Базовые данные пользователя обновлены', { user_id: updatedUser.id });
    return updatedUser;
  } catch (error) {
    logger.error('USER', 'Ошибка в updateUserBasicData', error);
    throw error;
  }
};

module.exports = {
  ensureUserInDatabase,
  updateUserBasicData
};

