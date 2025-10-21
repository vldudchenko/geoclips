/**
 * Конфигурация Supabase клиента
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./environment');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

module.exports = supabase;

