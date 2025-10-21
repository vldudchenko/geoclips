// Централизованное логирование для клиентского приложения
import { API_BASE_URL } from './constants';

class Logger {
  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'development' || true; // Всегда включено для отладки
  }

  // Отправка лога на сервер
  async sendLog(level, message, data = null, component = 'CLIENT') {
    if (!this.isEnabled) return;

    try {
      await fetch(`${API_BASE_URL}/api/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level,
          message,
          data,
          timestamp: new Date().toISOString(),
          component
        })
      });
    } catch (error) {
      // Если не удается отправить на сервер, выводим в консоль браузера
      console.error('Ошибка отправки лога на сервер:', error);
    }
  }

  // Логирование аватаров
  async logAvatar(action, userId, avatarUrl = null, data = null) {
    if (!this.isEnabled) return;

    try {
      await fetch(`${API_BASE_URL}/api/log/avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          userId,
          avatarUrl,
          data
        })
      });
    } catch (error) {
      console.error('Ошибка отправки лога аватара на сервер:', error);
    }
  }

  // Логирование карты
  async logMap(action, data = null) {
    if (!this.isEnabled) return;

    try {
      await fetch(`${API_BASE_URL}/api/log/map`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          data
        })
      });
    } catch (error) {
      console.error('Ошибка отправки лога карты на сервер:', error);
    }
  }

  // Основные методы логирования
  async error(message, data = null, component = 'CLIENT') {
    await this.sendLog('error', message, data, component);
  }

  async warn(message, data = null, component = 'CLIENT') {
    await this.sendLog('warn', message, data, component);
  }

  async info(message, data = null, component = 'CLIENT') {
    await this.sendLog('info', message, data, component);
  }

  async debug(message, data = null, component = 'CLIENT') {
    await this.sendLog('debug', message, data, component);
  }

  async success(message, data = null, component = 'CLIENT') {
    await this.sendLog('success', message, data, component);
  }

  async loading(message, data = null, component = 'CLIENT') {
    await this.sendLog('loading', message, data, component);
  }

  async cache(message, data = null, component = 'CLIENT') {
    await this.sendLog('cache', message, data, component);
  }

  async avatar(message, data = null, component = 'CLIENT') {
    await this.sendLog('avatar', message, data, component);
  }

  async video(message, data = null, component = 'CLIENT') {
    await this.sendLog('video', message, data, component);
  }

  async map(message, data = null, component = 'CLIENT') {
    await this.sendLog('map', message, data, component);
  }
}

// Создаем единственный экземпляр логгера
const logger = new Logger();

export default logger;
