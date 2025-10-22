/**
 * Сервис для работы с аватарами
 */

const axios = require('axios');
const sharp = require('sharp');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Создание аватара пользователя в Supabase Storage
 */
const createUserAvatar = async (yandexUserData, existingUserId = null) => {
  try {
    logger.loading('AVATAR', 'Создание аватара для пользователя', { yandex_id: yandexUserData.id });
    
    const yandexAvatarUrl = `https://avatars.yandex.net/get-yapic/${yandexUserData.default_avatar_id}/islands-200`;
    logger.info('AVATAR', 'Загружаем аватар из Яндекс', { url: yandexAvatarUrl });
    
    // Скачиваем аватар из Яндекс
    const avatarResponse = await axios.get(yandexAvatarUrl, { responseType: 'arraybuffer' });
    const avatarBuffer = Buffer.from(avatarResponse.data);
    
    // Создаем круглый аватар с помощью Sharp
    const circularAvatarBuffer = await sharp(avatarBuffer)
      .resize(200, 200)
      .composite([{
        input: Buffer.from(`
          <svg width="200" height="200">
            <circle cx="100" cy="100" r="98" fill="white"/>
          </svg>
        `),
        blend: 'dest-in'
      }])
      .jpeg({ quality: 90 })
      .toBuffer();
    
    // Если передан existingUserId, используем его, иначе создаем нового пользователя
    let userId;
    if (existingUserId) {
      userId = existingUserId;
      logger.info('AVATAR', 'Используем существующего пользователя', { userId });
    } else {
      // Создаем пользователя только если не передан existingUserId
      const tempUserData = {
        yandex_id: yandexUserData.id,
        first_name: yandexUserData.first_name || 'Пользователь',
        last_name: yandexUserData.last_name || '',
        display_name: yandexUserData.display_name || yandexUserData.real_name || yandexUserData.login,
        avatar_url: null,
        created_at: new Date().toISOString(),
      };
      
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([tempUserData])
        .select('id, yandex_id, first_name, last_name, display_name, avatar_url')
        .maybeSingle();
      
      if (insertError) {
        logger.error('AVATAR', 'Ошибка создания пользователя', insertError);
        throw insertError;
      }
      
      userId = newUser.id;
    }
    
    // Загружаем аватар в Storage
    const avatarUrl = await uploadAvatarToStorage(userId, circularAvatarBuffer);
    
    // Обновляем пользователя с URL аватара
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ 
        avatar_url: avatarUrl,
      })
      .eq('id', userId)
      .select('id, yandex_id, first_name, last_name, display_name, avatar_url')
      .maybeSingle();
    
    if (updateError) {
      logger.error('AVATAR', 'Ошибка обновления аватара', updateError);
      throw updateError;
    }
    
    logger.success('AVATAR', 'Аватар успешно создан', { user_id: updatedUser.id, avatar_url: avatarUrl });
    return avatarUrl;
  } catch (error) {
    logger.error('AVATAR', 'Ошибка создания аватара', error);
    return null;
  }
};

/**
 * Загрузка аватара в Supabase Storage
 */
const uploadAvatarToStorage = async (userId, avatarBuffer) => {
  try {
    const fileName = `avatar.jpg`;
    const filePath = `${userId}/${fileName}`;
    
    logger.loading('AVATAR', 'Загрузка аватара в Storage', { file_path: filePath });

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('geoclips-videos')
      .upload(filePath, avatarBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      logger.error('AVATAR', 'Ошибка загрузки аватара в Storage', uploadError);
      throw uploadError;
    }

    // Получаем публичный URL
    const { data: urlData } = supabase.storage
      .from('geoclips-videos')
      .getPublicUrl(filePath);

    const avatarUrl = urlData.publicUrl;
    logger.success('AVATAR', 'Аватар успешно загружен', { avatar_url: avatarUrl });

    return avatarUrl;
  } catch (error) {
    logger.error('AVATAR', 'Ошибка загрузки аватара', error);
    throw error;
  }
};

module.exports = {
  createUserAvatar,
  uploadAvatarToStorage
};

