# GeoClips Server

Node.js/Express сервер для GeoClips - платформы геолокационных видео.

## 📁 Структура

```
server/
├── config/              # Конфигурация
│   ├── environment.js   # Переменные окружения
│   ├── supabase.js     # Клиент Supabase
│   └── passport.js     # OAuth настройки
│
├── middleware/          # Middleware
│   ├── errorHandler.js # Обработка ошибок
│   └── validation.js   # Валидация данных
│
├── routes/             # API роуты
│   ├── auth.js         # Аутентификация
│   ├── api.js          # Основной API
│   ├── video.js        # Работа с видео
│   └── admin.js        # Админ-панель
│
├── services/           # Бизнес-логика
│   ├── userService.js  # Управление пользователями
│   └── avatarService.js # Работа с аватарами
│
├── utils/              # Утилиты
│   ├── logger.js       # Логирование
│   ├── cacheUtils.js   # Кэширование
│   ├── geoUtils.js     # Геоданные
│   └── fileUtils.js    # Файлы
│
├── views/              # HTML шаблоны
│   ├── admin.html      # Админ-панель
│   ├── admin.css       # Стили
│   └── admin.js        # Скрипты
│
├── uploads/            # Загруженные файлы
│   ├── videos/
│   ├── thumbnails/
│   └── avatars/
│
└── index.js            # Точка входа
```

## 🔧 Конфигурация

### Переменные окружения

Создайте `.env` файл:

```env
# Сервер
PORT=5000
BASE_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000
NODE_ENV=development

# Supabase
REACT_APP_SUPABASE_URL=your_url
REACT_APP_SUPABASE_ANON_KEY=your_key

# Yandex OAuth
YANDEX_CLIENT_ID=your_id
YANDEX_CLIENT_SECRET=your_secret
YANDEX_API_KEY=your_api_key

# Session
SESSION_SECRET=your_secret

# Cache
CACHE_TTL=300000
```

## 🚀 Запуск

### Разработка
```bash
npm run dev
```

### Продакшн
```bash
npm start
```

## 📚 API Документация

### Аутентификация

#### `GET /auth/yandex`
Начать OAuth процесс

#### `GET /auth/yandex/callback`
Callback после авторизации

#### `GET /auth/me`
Получить текущего пользователя

**Response:**
```json
{
  "isAuthenticated": true,
  "user": {
    "id": "123",
    "displayName": "John Doe",
    "dbUser": { ... }
  }
}
```

#### `POST /auth/logout`
Выйти из системы

### API

#### `POST /api/geocode`
Геокодирование адреса

**Request:**
```json
{
  "address": "Москва, Красная площадь"
}
```

**Response:**
```json
{
  "address": "Россия, Москва, Красная площадь",
  "coordinates": {
    "longitude": 37.617298,
    "latitude": 55.753215
  }
}
```

#### `GET /api/yandex-user-data?accessToken=TOKEN`
Получить данные пользователя Яндекс

#### `POST /api/video/validate-video`
Валидация видео файла

**Request:** multipart/form-data с полем `video`

**Response:**
```json
{
  "isValid": true,
  "duration": 45.5,
  "fileSize": 1024000
}
```

### Видео

#### `POST /api/video/generate-thumbnail`
Генерация превью видео

**Request:** multipart/form-data с полем `video`

**Response:**
```json
{
  "success": true,
  "thumbnailPath": "/uploads/thumbnails/abc123.jpg"
}
```

#### `DELETE /api/video/:videoId`
Удаление видео

**Headers:** Authorization required

**Response:**
```json
{
  "success": true,
  "message": "Видео успешно удалено"
}
```

### Админ

#### `GET /admin`
Админ-панель (HTML)

#### `GET /admin/stats`
Статистика приложения

**Response:**
```json
{
  "usersCount": 150,
  "videosCount": 320,
  "totalViews": 5400,
  "totalLikes": 890
}
```

#### `GET /admin/users`
Список пользователей

#### `GET /admin/videos`
Список видео

## 🛠️ Модули

### Logger (`utils/logger.js`)

Централизованная система логирования с разными уровнями:

```javascript
const logger = require('./utils/logger');

logger.error('COMPONENT', 'Error message', { data });
logger.warn('COMPONENT', 'Warning message');
logger.info('COMPONENT', 'Info message');
logger.success('COMPONENT', 'Success message');
logger.debug('COMPONENT', 'Debug message');
```

### Cache (`utils/cacheUtils.js`)

Управление кэшем с TTL:

```javascript
const cache = require('./utils/cacheUtils');

// Установить
cache.set('key', data, ttl);

// Получить
const data = cache.get('key');

// Удалить
cache.delete('key');

// Очистить всё
cache.clear();
```

### GeoUtils (`utils/geoUtils.js`)

Работа с геоданными:

```javascript
const { calculateDistance, isValidCoordinates } = require('./utils/geoUtils');

const distance = calculateDistance(lat1, lon1, lat2, lon2);
const isValid = isValidCoordinates(lat, lon);
```

## 🔒 Middleware

### Error Handler

Централизованная обработка ошибок:

```javascript
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

app.use(notFoundHandler);
app.use(errorHandler);
```

### Validation

Валидация входных данных:

```javascript
const { validateCoordinates, validateAccessToken } = require('./middleware/validation');

router.post('/endpoint', validateCoordinates, handler);
```

## 📊 Сервисы

### UserService

Управление пользователями:

```javascript
const { ensureUserInDatabase, updateUserBasicData } = require('./services/userService');

const user = await ensureUserInDatabase(yandexUserData);
const updated = await updateUserBasicData(yandexUserData);
```

### AvatarService

Работа с аватарами:

```javascript
const { createUserAvatar } = require('./services/avatarService');

const avatarUrl = await createUserAvatar(yandexUserData);
```

## 🔧 Разработка

### Добавление нового роута

1. Создайте файл в `routes/`
2. Определите роуты
3. Подключите в `index.js`

```javascript
// routes/myRoute.js
const express = require('express');
const router = express.Router();

router.get('/endpoint', (req, res) => {
  res.json({ message: 'Hello' });
});

module.exports = router;

// index.js
const myRoute = require('./routes/myRoute');
app.use('/api', myRoute);
```

### Добавление middleware

```javascript
// middleware/myMiddleware.js
module.exports = (req, res, next) => {
  // ваша логика
  next();
};

// Использование
const myMiddleware = require('./middleware/myMiddleware');
app.use(myMiddleware);
```

## 📝 Лицензия

MIT

