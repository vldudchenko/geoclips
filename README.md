# 🌍 GeoClips

**GeoClips** — геолокационная видео-платформа с интерактивной картой Яндекс. Пользователи могут загружать видео с привязкой к конкретным географическим координатам, просматривать их на карте и делиться контентом.

![Version](https://img.shields.io/badge/version-2.2.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 📋 Содержание

- [Возможности](#возможности)
- [Технологии](#технологии)
- [Требования](#требования)
- [Установка](#установка)
- [Конфигурация](#конфигурация)
- [Запуск](#запуск)
- [Структура проекта](#структура-проекта)
- [API](#api)
- [Разработка](#разработка)
- [Лицензия](#лицензия)

## ✨ Возможности

- 📍 **Геолокация** — загрузка видео с привязкой к координатам на карте
- 🗺️ **Интерактивная карта** — отображение всех видео на Яндекс.Картах
- 👤 **Профили пользователей** — персональные страницы с загруженными видео
- 💬 **Комментарии** — обсуждение видеороликов
- 🏷️ **Теги** — категоризация и поиск контента
- 🔐 **Авторизация** — OAuth через Яндекс ID
- 📊 **Статистика** — аналитика просмотров и активности
- 🖼️ **Миниатюры** — автоматическая генерация превью видео
- ⚡ **Кэширование** — Redis для оптимизации производительности
- 📱 **Адаптивный дизайн** — работает на всех устройствах

## 🛠 Технологии

### Frontend
- **React** 18.2 — UI библиотека
- **React Router** 7.9 — маршрутизация
- **Axios** — HTTP клиент
- **Яндекс.Карты API** — интерактивные карты

### Backend
- **Node.js** + **Express** — серверная платформа
- **Supabase** — база данных и аутентификация
- **Passport** (OAuth2) — авторизация
- **FFmpeg** — обработка видео
- **Sharp** — обработка изображений
- **Redis** (опционально) — кэширование
- **Multer** — загрузка файлов

### Безопасность
- **Helmet** — защита HTTP заголовков
- **CORS** — контроль доступа
- **Rate Limiting** — защита от спама
- **SQL Injection Prevention** — валидация данных
- **Session Management** — безопасные сессии

## 📦 Требования

- **Node.js** >= 16.x
- **npm** >= 8.x
- **FFmpeg** — для обработки видео
- **Supabase аккаунт** — для базы данных
- **Яндекс API ключ** — для карт
- **Redis** (опционально) — для кэширования

## 🚀 Установка

### 1. Клонирование репозитория

```bash
git clone https://github.com/yourusername/geoclips.git
cd geoclips
```

### 2. Установка зависимостей

```bash
# Установка всех зависимостей (клиент + сервер)
npm run install-all
```

Или установка по отдельности:

```bash
# Только сервер
cd server && npm install

# Только клиент
cd client && npm install
```

### 3. Установка FFmpeg

**Windows:**
```powershell
# Через Chocolatey
choco install ffmpeg

# Или скачайте с https://ffmpeg.org/download.html
```

**Linux:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

## ⚙️ Конфигурация

### 1. Переменные окружения для сервера

Создайте файл `server/.env`:

```env
# Основные настройки
NODE_ENV=development
PORT=5000
BASE_URL=http://localhost:5000

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Яндекс OAuth
YANDEX_CLIENT_ID=your_yandex_client_id
YANDEX_CLIENT_SECRET=your_yandex_client_secret
YANDEX_CALLBACK_URL=http://localhost:5000/auth/yandex/callback

# Session
SESSION_SECRET=your_random_session_secret_key

# Redis (опционально)
REDIS_URL=redis://localhost:6379

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000

# Загрузка файлов
MAX_FILE_SIZE=524288000  # 500MB в байтах
MAX_FIELD_SIZE=26214400  # 25MB в байтах
```

### 2. Переменные окружения для клиента

Создайте файл `client/.env`:

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_YANDEX_MAPS_API_KEY=your_yandex_maps_api_key
```

### 3. Настройка Supabase

Создайте необходимые таблицы в Supabase. SQL схемы находятся в директории `/sql`.

### 4. Настройка Яндекс OAuth

1. Зарегистрируйте приложение на https://oauth.yandex.ru/
2. Укажите Callback URL: `http://localhost:5000/auth/yandex/callback`
3. Скопируйте Client ID и Client Secret в `.env`

## 🎬 Запуск

### Режим разработки

```bash
# Запуск клиента и сервера одновременно
npm run dev

# Или по отдельности:
npm run client   # Запуск только клиента (порт 3000)
npm run server   # Запуск только сервера (порт 5000)
```

### Режим production

```bash
# Сборка клиента
npm run build

# Запуск сервера (будет раздавать собранный клиент)
npm start
```

Приложение будет доступно:
- **Клиент**: http://localhost:3000 (dev) / http://localhost:5000 (prod)
- **API**: http://localhost:5000/api
- **Админ-панель**: http://localhost:5000/admin

## 📁 Структура проекта

```
geoclips/
├── client/                    # React приложение
│   ├── public/               # Статические файлы
│   └── src/
│       ├── components/       # React компоненты
│       │   ├── YandexMap.js        # Карта
│       │   ├── VideoPlayer.js      # Видеоплеер
│       │   ├── ProfilePage.js      # Профиль
│       │   ├── VideoPage.js        # Страница видео
│       │   └── Comments.js         # Комментарии
│       ├── services/         # API сервисы
│       │   ├── videoService.js     # Работа с видео
│       │   ├── userService.js      # Работа с пользователями
│       │   └── cacheService.js     # Кэширование
│       ├── hooks/            # React хуки
│       │   └── useAuth.js          # Авторизация
│       ├── utils/            # Утилиты
│       └── App.js            # Главный компонент
│
├── server/                   # Express сервер
│   ├── config/              # Конфигурация
│   │   ├── environment.js          # Переменные окружения
│   │   ├── passport.js             # Настройка OAuth
│   │   └── supabase.js             # Supabase клиент
│   ├── routes/              # API роуты
│   │   ├── api.js                  # Основные API
│   │   ├── auth.js                 # Авторизация
│   │   ├── video.js                # Работа с видео
│   │   ├── users.js                # Пользователи
│   │   ├── comments.js             # Комментарии
│   │   └── tags.js                 # Теги
│   ├── middleware/          # Middleware
│   │   ├── unified.js              # Объединенные middleware
│   │   └── apiResponse.js          # Форматирование ответов
│   ├── services/            # Бизнес-логика
│   │   ├── authService.js          # Сервис авторизации
│   │   ├── userService.js          # Сервис пользователей
│   │   └── avatarService.js        # Работа с аватарами
│   ├── utils/               # Утилиты
│   │   ├── fileUtils.js            # Работа с файлами
│   │   ├── geoUtils.js             # Геолокация
│   │   ├── cacheUtils.js           # Кэширование
│   │   └── logger.js               # Логирование
│   ├── uploads/             # Загруженные файлы
│   │   ├── videos/                 # Видеофайлы
│   │   ├── thumbnails/             # Миниатюры
│   │   └── avatars/                # Аватары
│   └── index.js             # Точка входа
│
├── shared/                  # Общие модули
│   ├── constants.js         # Константы
│   └── validators.js        # Валидаторы
│
├── sql/                     # SQL схемы
├── package.json             # Корневые зависимости
└── README.md                # Документация
```

## 🔌 API

### Авторизация

```
GET  /auth/yandex              # OAuth вход через Яндекс
GET  /auth/yandex/callback     # OAuth callback
GET  /auth/me                  # Получить текущего пользователя
POST /auth/logout              # Выход
```

### Видео

```
GET    /api/video                    # Список всех видео
GET    /api/video/:id                # Получить видео по ID
POST   /api/video/upload             # Загрузить видео
DELETE /api/video/:id                # Удалить видео
GET    /api/video/user/:userId       # Видео пользователя
```

### Пользователи

```
GET    /api/users/:identifier        # Профиль пользователя
PUT    /api/users/:userId            # Обновить профиль
POST   /api/users/:userId/avatar     # Загрузить аватар
GET    /api/users/:userId/stats      # Статистика пользователя
```

### Комментарии

```
GET    /api/comments/video/:videoId  # Комментарии к видео
POST   /api/comments                 # Добавить комментарий
DELETE /api/comments/:commentId      # Удалить комментарий
```

### Теги

```
GET    /api/tags                     # Список всех тегов
GET    /api/tags/:tag/videos         # Видео по тегу
```

## 🔧 Разработка

### Полезные команды

```bash
# Установка зависимостей
npm run install-all

# Разработка (hot reload)
npm run dev

# Запуск только сервера с nodemon
npm run server-dev

# Сборка production
npm run build

# Линтинг (если настроен)
npm run lint
```

### Debug режим

В режиме разработки доступны debug роуты:

```
GET /debug/session      # Информация о сессии
GET /debug/user         # Информация о пользователе
GET /debug/env          # Переменные окружения
```

### Логирование

Сервер использует кастомный логгер с цветным выводом:

```javascript
const logger = require('./utils/logger');

logger.info('MODULE', 'Информационное сообщение');
logger.success('MODULE', 'Успешная операция');
logger.warn('MODULE', 'Предупреждение');
logger.error('MODULE', 'Ошибка', error);
```

## 🔒 Безопасность

Проект включает следующие меры безопасности:

- ✅ Rate Limiting для всех API endpoints
- ✅ Защита от SQL инъекций
- ✅ Санитизация пользовательского ввода
- ✅ Безопасные HTTP заголовки (Helmet)
- ✅ CORS защита
- ✅ Защищенные сессии (httpOnly cookies)
- ✅ Проверка размера загружаемых файлов
- ✅ Логирование подозрительной активности

## 📝 Лицензия

MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

**Разработано с ❤️ для геолокационного видео-контента**

