/**
 * Конфигурация окружения
 * Централизованное управление переменными окружения
 */

require('dotenv').config();

const config = {
  // Сервер
  port: process.env.PORT || 5000,
  baseUrl: process.env.BASE_URL || 'http://192.168.31.164:5000',
  clientUrl: process.env.CLIENT_URL || 'http://192.168.31.164:3000',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Supabase
  supabase: {
    url: process.env.REACT_APP_SUPABASE_URL || 'https://dfzlheyjqazpwqtiqdsp.supabase.co',
    anonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmemxoZXlqcWF6cHdxdGlxZHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NDA5NTUsImV4cCI6MjA3NjAxNjk1NX0.OBc35yo7lXt4sv7zOPPyKegP9nqDUOVqRGaVPy8cjiE'
  },

  // Yandex OAuth
  yandex: {
    clientId: process.env.YANDEX_CLIENT_ID || 'dbdc7963b53143ca9a2326863abdcfb7',
    clientSecret: process.env.YANDEX_CLIENT_SECRET || 'fed84492cc2c418eb595b749d8a8fe91',
    apiKey: process.env.YANDEX_API_KEY || 'd994023b-b074-4c2b-a251-eb5f1a7ce0d3'
  },

  // Session
  session: {
    secret: process.env.SESSION_SECRET || 'geoclips-secret-key-change-in-production',
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
      'http://127.0.0.1:3000',
      'http://192.168.31.164:3000'
    ]
  }
};

module.exports = config;

