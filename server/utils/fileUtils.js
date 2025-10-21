/**
 * Утилиты для работы с файлами
 */

const fs = require('fs').promises;
const logger = require('./logger');

/**
 * Создание директорий для загрузок
 */
const ensureUploadDirs = async () => {
  const dirs = ['uploads', 'uploads/videos', 'uploads/thumbnails', 'uploads/avatars'];
  
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
};

/**
 * Удаление временного файла
 */
const deleteTempFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    logger.debug('FILES', `Временный файл удален: ${filePath}`);
  } catch (error) {
    logger.warn('FILES', `Не удалось удалить временный файл: ${filePath}`, error);
  }
};

/**
 * Проверка существования файла
 */
const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

module.exports = {
  ensureUploadDirs,
  deleteTempFile,
  fileExists
};

