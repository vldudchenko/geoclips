# GeoClips Server - Оптимизированная структура

## Обзор оптимизации

Серверная часть проекта была полностью оптимизирована для повышения читаемости, производительности и удобства сопровождения.

## Структура каталогов

```
server/
├── config/                 # Конфигурация
│   ├── environment.js      # Переменные окружения
│   ├── passport.js         # OAuth конфигурация
│   └── supabase.js         # База данных
├── middleware/             # Middleware (объединенные)
│   └── unified.js          # Все middleware в одном файле
├── routes/                 # API роуты
│   ├── index.js           # Главный роутер админки
│   ├── main.js            # Основные роуты админки
│   ├── api.js             # API для клиента
│   ├── auth.js            # Аутентификация
│   ├── video.js           # Видео (объединенные функции)
│   ├── stats.js           # Статистика и аналитика
│   ├── users.js           # Управление пользователями
│   ├── tags.js            # Управление тегами
│   ├── system.js          # Системная информация
│   └── debug.js           # Debug роуты (только dev)
├── services/              # Бизнес-логика
│   ├── authService.js     # Сервис аутентификации
│   ├── userService.js     # Сервис пользователей
│   └── avatarService.js   # Сервис аватаров
├── utils/                 # Утилиты
│   ├── dbUtils.js         # Работа с БД
│   ├── cacheUtils.js      # Кэширование
│   ├── fileUtils.js       # Работа с файлами
│   ├── geoUtils.js        # Геоданные
│   └── logger.js          # Логирование
├── views/                 # HTML/CSS/JS для админки
│   ├── admin.html         # Главная страница админки
│   ├── admin.css          # Стили админки
│   ├── admin-unified.js   # Объединенный JS админки
│   └── login.html         # Страница входа
├── uploads/               # Загруженные файлы
│   ├── videos/           # Видео файлы
│   ├── thumbnails/       # Превью видео
│   └── avatars/          # Аватары пользователей
├── index.js              # Главный файл сервера
└── package.json          # Зависимости
```

## Основные улучшения

### 1. Объединение дублирующихся файлов
- **video.js** + **adminVideos.js** → **video.js** (объединенные функции)
- **auth.js** + **validation.js** + **security.js** + **rateLimiter.js** + **errorHandler.js** → **unified.js**
- **admin.js** + **admin-core.js** + **admin-router.js** → **admin-unified.js**

### 2. Упрощение структуры
- Удалены неиспользуемые файлы
- Объединены похожие функции
- Улучшена читаемость кода

### 3. Оптимизация middleware
- Все middleware в одном файле для упрощения импортов
- Улучшена производительность
- Упрощена отладка

### 4. Улучшение админки
- Объединенный JS файл для всех функций админки
- Упрощенная структура HTML
- Улучшенная производительность загрузки

## API Endpoints

### Основные роуты
- `GET /` - Главная страница (редирект на админку)
- `GET /admin` - Админ панель
- `GET /auth/login` - Страница входа

### API роуты
- `POST /api/geocode` - Геокодирование адреса
- `GET /api/yandex-user-data` - Данные пользователя Яндекс
- `POST /api/update-user-data` - Обновление данных пользователя
- `GET /api/profile/:identifier` - Профиль пользователя
- `POST /api/videos/:videoId/like` - Лайк видео
- `DELETE /api/videos/:videoId/like` - Убрать лайк
- `GET /api/videos/near` - Видео по радиусу

### Видео роуты
- `POST /api/video/validate-video` - Валидация видео
- `DELETE /api/video/:videoId` - Удаление видео (пользователь)
- `GET /api/video/:videoId/tags` - Теги видео
- `POST /api/video/:videoId/tags` - Добавить теги
- `DELETE /api/video/:videoId/tags/:tagId` - Удалить тег

### Админ роуты
- `GET /admin/stats` - Статистика
- `GET /admin/analytics` - Аналитика
- `GET /admin/users` - Список пользователей
- `GET /admin/videos/admin` - Список видео
- `GET /admin/tags` - Список тегов
- `GET /admin/system/info` - Системная информация

## Middleware

### Авторизация
- `requireAuth` - Требует авторизации
- `optionalAuth` - Опциональная авторизация
- `requireAdmin` - Требует права администратора

### Валидация
- `validateCoordinates` - Валидация координат
- `validateAccessToken` - Валидация токена
- `validateAddress` - Валидация адреса
- `validateFile` - Валидация файла

### Безопасность
- `sanitizeInput` - Очистка входных данных
- `preventSqlInjection` - Защита от SQL инъекций
- `setSecurityHeaders` - Security заголовки
- `logSuspiciousActivity` - Логирование подозрительной активности

### Rate Limiting
- `limiters.auth` - Лимиты для авторизации
- `limiters.api` - Лимиты для API
- `limiters.upload` - Лимиты для загрузки
- `limiters.read` - Лимиты для чтения

## Конфигурация

### Переменные окружения
```env
# Сервер
PORT=3001
NODE_ENV=development
BASE_URL=http://localhost:3001
CLIENT_URL=http://localhost:3000

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# Yandex OAuth
YANDEX_CLIENT_ID=your_client_id
YANDEX_CLIENT_SECRET=your_client_secret
YANDEX_API_KEY=your_api_key
YANDEX_REDIRECT_URI=http://localhost:3001/auth/yandex/callback

# Session
SESSION_SECRET=your_session_secret

# Admin
ADMIN_IDS=user_id1,user_id2

# Features
ALLOW_PROFILE_BY_TOKEN=true
```

## Запуск

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Запуск в продакшене
npm start
```

## Мониторинг

### Логи
- Все логи централизованы через `logger.js`
- Поддержка разных уровней логирования
- Эмодзи для лучшей читаемости

### Debug роуты (только dev)
- `GET /debug/check-users` - Проверка пользователей
- `GET /debug/test-rls` - Тест RLS политик
- `GET /debug/cache-info` - Информация о кэше
- `POST /debug/clear-cache` - Очистка кэша
- `GET /debug/config` - Конфигурация
- `GET /debug/rate-limit-stats` - Статистика rate limiter

## Производительность

### Оптимизации
- Объединенные middleware для снижения накладных расходов
- Кэширование часто используемых данных
- Rate limiting для защиты от злоупотреблений
- Сжатие ответов (gzip)
- Оптимизированные SQL запросы

### Мониторинг
- Системная информация в админке
- Статистика использования
- Логи производительности
- Rate limiting статистика

## Безопасность

### Защита
- XSS защита
- SQL injection защита
- CSRF защита
- Rate limiting
- Security заголовки
- Валидация входных данных

### Аутентификация
- OAuth 2.0 через Яндекс
- Session-based авторизация
- Bearer token поддержка (dev)
- Права администратора

## Поддержка

При возникновении проблем проверьте:
1. Логи сервера
2. Переменные окружения
3. Подключение к Supabase
4. Настройки Яндекс OAuth
5. Права доступа к файлам

Для отладки используйте debug роуты в режиме разработки.
