/**
 * Централизованная система логирования
 */

const config = require('../config/environment');

class Logger {
  constructor() {
    this.isDevelopment = config.nodeEnv === 'development';
    this.isProduction = config.nodeEnv === 'production';
  }

  // Форматирование сообщения
  _format(level, component, message, data) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] [${component}] ${message}${dataStr}`;
  }

  // Логирование с уровнями
  log(level, component, message, data = null) {
    const emoji = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🔍',
      success: '✅',
      loading: '🔄',
      cache: '💾',
      avatar: '👤',
      video: '📺',
      map: '🗺️',
      auth: '🔐',
      upload: '📤',
      download: '📥'
    };

    const icon = emoji[level] || '📝';
    const logMessage = `${icon} [${component}] ${message}`;
    const logData = data ? ` | ${JSON.stringify(data)}` : '';

    // В разработке показываем все логи
    if (this.isDevelopment) {
      switch (level) {
        case 'error':
          console.error(logMessage + logData);
          break;
        case 'warn':
          console.warn(logMessage + logData);
          break;
        default:
          console.log(logMessage + logData);
      }
    }
    // В продакшене только ошибки и важные события
    else if (this.isProduction && ['error', 'warn', 'success'].includes(level)) {
      console.log(this._format(level, component, message, data));
    }
  }

  error(component, message, data) {
    this.log('error', component, message, data);
  }

  warn(component, message, data) {
    this.log('warn', component, message, data);
  }

  info(component, message, data) {
    this.log('info', component, message, data);
  }

  debug(component, message, data) {
    this.log('debug', component, message, data);
  }

  success(component, message, data) {
    this.log('success', component, message, data);
  }

  loading(component, message, data) {
    this.log('loading', component, message, data);
  }

  cache(component, message, data) {
    this.log('cache', component, message, data);
  }

  auth(message, data) {
    this.log('auth', 'AUTH', message, data);
  }

  video(message, data) {
    this.log('video', 'VIDEO', message, data);
  }

  map(message, data) {
    this.log('map', 'MAP', message, data);
  }
}

module.exports = new Logger();

