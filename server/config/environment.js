/**
 * Конфигурация окружения
 * Централизованное управление переменными окружения
 */

require('dotenv').config({ path: './.env' });

const config = {
  // Сервер
  port: process.env.PORT,
  baseUrl: process.env.BASE_URL,
  clientUrl: process.env.CLIENT_URL,
  nodeEnv: process.env.NODE_ENV,

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  },

  // Yandex OAuth
  yandex: {
    clientId: process.env.YANDEX_CLIENT_ID || '',
    clientSecret: process.env.YANDEX_CLIENT_SECRET || '',
    apiKey: process.env.YANDEX_API_KEY || '',
    redirectUri: process.env.YANDEX_REDIRECT_URI || ''
  },

  // Session
  session: {
    secret: process.env.SESSION_SECRET || '',
    secure: process.env.NODE_ENV === 'production'
  },

  // Cache
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 5 * 60 * 1000 // 5 минут
  },

  // Upload limits
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFieldSize: 10 * 1024 * 1024 // 10MB
  },

  // CORS
  cors: {
    allowedOrigins: [
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ]
  },

  // Admin
  admin: {
    ids: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : []
  },

  // Feature flags
  features: {
    allowProfileLookupByAccessToken: process.env.ALLOW_PROFILE_BY_TOKEN === 'true'
  }
};

module.exports = config;

