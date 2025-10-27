const { createClient } = require('@supabase/supabase-js');
const config = require('./environment');

// Используем service role key для серверных операций, чтобы обойти RLS
// Service role key имеет полный доступ к базе данных
const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey;

// Ожидаем, что переменные заданы в server/.env и загружены в environment.js
const supabase = createClient(config.supabase.url, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = supabase;