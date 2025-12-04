/**
 * Утилиты для работы с файлами
 * Логика загрузки файлов удалена - теперь используется только Supabase Storage
 */

const fs = require('fs').promises;
const logger = require('./logger');

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
  deleteTempFile,
  fileExists
};

