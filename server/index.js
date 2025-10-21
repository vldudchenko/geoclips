/**
 * GeoClips Server - Оптимизированная версия
 * Сервер для работы с геолокационными видео
 */

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
let RedisStore = null;
let redisClient = null;

// Конфигурация
const config = require('./config/environment');
const passport = require('./config/passport');
const logger = require('./utils/logger');

// Middleware
const { handleMulterError, errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requireAuth, optionalAuth } = require('./middleware/auth');
const { limiters } = require('./middleware/rateLimiter');
const { 
  sanitizeInput, 
  setSecurityHeaders, 
  preventSqlInjection,
  logSuspiciousActivity 
} = require('./middleware/security');

// Роуты
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const videoRoutes = require('./routes/video');
const adminRoutes = require('./routes/admin');

// Утилиты
const { ensureUploadDirs } = require('./utils/fileUtils');

// Создаем приложение
const app = express();

// Trust proxy when running behind reverse proxies (needed for correct IPs and secure cookies)
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

// CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, curl/сервер-сервер)
    if (!origin) return callback(null, true);

    const isAllowed = config.cors.allowedOrigins.indexOf(origin) !== -1;
    if (config.nodeEnv === 'production') {
      // В продакшене строго ограничиваем источники
      return callback(isAllowed ? null : new Error('Not allowed by CORS'), isAllowed);
    }
    // В разработке разрешаем все домены
    return callback(null, true);
  },
  credentials: true
}));

// Security: стандартные заголовки и защита
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Сжатие ответов
app.use(compression());

// Security middleware (должны быть до body parsing)
app.use(setSecurityHeaders);
app.use(logSuspiciousActivity);

// Body parsing middleware
// Дополнительная защита по размеру запроса до парсинга тела
const { checkRequestSize } = require('./middleware/security');
app.use(checkRequestSize(config.upload.maxFieldSize));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Security middleware (после body parsing)
app.use(sanitizeInput);
app.use(preventSqlInjection);

// Session middleware
// Опционально используем Redis при наличии REDIS_URL
if (process.env.REDIS_URL) {
  try {
    const connectRedis = require('connect-redis');
    const IORedis = require('ioredis');
    RedisStore = connectRedis(session);
    redisClient = new IORedis(process.env.REDIS_URL);
    logger.info('SERVER', 'Redis session store включен');
  } catch (e) {
    logger.warn('SERVER', 'Не удалось инициализировать Redis store, используем memory store', { error: e.message });
  }
}

app.use(session({
  store: RedisStore && redisClient ? new RedisStore({ client: redisClient, prefix: 'geoclips:sess:' }) : undefined,
  name: 'geoclips.sid',
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: config.session.secure,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 часа
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Статические файлы
app.use('/uploads', express.static('uploads', {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
  }
}));

// Обработка статических файлов для Hot Module Replacement (только в режиме разработки)
if (config.nodeEnv !== 'production') {
  // Обработка hot-update файлов
  app.get('*.hot-update.*', (req, res) => {
    res.status(404).json({ error: 'Hot update file not found' });
  });
}
// Удаляем публичную раздачу админки, доступ только через защищенные роуты

// API роуты с rate limiting
app.use('/auth', limiters.auth, authRoutes);
// Монтируем видео-роуты под /api, избегая двойного применения лимитеров
app.use('/api', limiters.api, apiRoutes);
app.use('/api/video', limiters.upload, videoRoutes);
app.use('/admin', limiters.read, adminRoutes);

// Обработка корневого пути - перенаправляем на админку
app.get('/', (req, res) => {
  if (config.nodeEnv === 'production') {
    // В продакшене отдаём SPA клиент
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  } else {
    logger.info('SERVER', 'Запрос на корневой путь - перенаправляем на /admin');
    res.redirect('/admin');
  }
});

// Debug роуты (только в режиме разработки)
if (config.nodeEnv !== 'production') {
  const debugRoutes = require('./routes/debug');
  app.use('/debug', debugRoutes);
  logger.info('SERVER', 'Debug роуты включены: /debug/*');
}

// Обработка ошибок multer
app.use(handleMulterError);

// Раздача статики клиента (production)
if (config.nodeEnv === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/build');
  app.use(express.static(clientBuildPath));
  // SPA fallback для всех путей, кроме API/ADMIN/UPLOADS
  app.get('*', (req, res, next) => {
    const p = req.path || '';
    if (p.startsWith('/api') || p.startsWith('/auth') || p.startsWith('/admin') || p.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// 404 handler
app.use(notFoundHandler);

// Общий обработчик ошибок
app.use(errorHandler);

// Инициализация директорий для загрузок
ensureUploadDirs().catch(error => {
  logger.error('SERVER', 'Ошибка создания директорий', error);
});

// Запуск сервера
app.listen(config.port, '0.0.0.0', () => {
  logger.success('SERVER', `Сервер запущен на порту ${config.port}`);
  logger.info('SERVER', `Локальный доступ: http://localhost:${config.port}`);
  logger.info('SERVER', `Сетевой доступ: ${config.baseUrl}`);
  logger.info('SERVER', `Клиент: ${config.clientUrl}`);
  logger.info('SERVER', `Callback URL: ${config.baseUrl}/auth/yandex/callback`);
  logger.info('SERVER', `Режим: ${config.nodeEnv}`);
});

// Обработка неперехваченных ошибок
process.on('unhandledRejection', (reason, promise) => {
  logger.error('SERVER', 'Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('SERVER', 'Uncaught Exception', error);
  process.exit(1);
});

module.exports = app;
