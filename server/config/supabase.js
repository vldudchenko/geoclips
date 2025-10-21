const { createClient } = require('@supabase/supabase-js');
const config = require('./environment');

// Ожидаем, что переменные заданы в server/.env и загружены в environment.js
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

module.exports = supabase;