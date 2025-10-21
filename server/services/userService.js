/**
 * Сервис для работы с пользователями
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { createUserAvatar } = require('./avatarService');

/**
 * Проверка и создание пользователя в базе данных
 */
const ensureUserInDatabase = async (yandexUserData) => {
  try {
    logger.info('USER', 'Проверяем пользователя в базе данных', { yandex_id: yandexUserData.id });

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
      logger.info('USER', 'Создаем нового пользователя');
      
      // Создаем нового пользователя
      let avatarUrl = null;
      
      // Создаем аватар из Яндекс данных, если он есть
      if (yandexUserData.is_avatar_empty === false && yandexUserData.default_avatar_id) {
        avatarUrl = await createUserAvatar(yandexUserData);
      }
      
      const newUserData = {
        yandex_id: yandexUserData.id,
        first_name: yandexUserData.first_name || 'Пользователь',
        last_name: yandexUserData.last_name || '',
        display_name: yandexUserData.display_name || yandexUserData.real_name || yandexUserData.login,
        avatar_url: avatarUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([newUserData])
        .select('id, yandex_id, first_name, last_name, display_name, avatar_url')
        .maybeSingle();

      if (insertError) {
        logger.error('USER', 'Ошибка при создании пользователя', insertError);
        throw insertError;
      }

      logger.success('USER', 'Новый пользователь создан', { user_id: newUser.id });
      return newUser;
    }
  } catch (error) {
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

