import { createClient } from '@supabase/supabase-js';

// Используем переменные окружения для конфигурации
// ВАЖНО: Все запросы к Supabase должны проходить через сервер
// Этот клиент используется только для совместимости со старым кодом
// и будет постепенно удален
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not found in environment variables. Direct Supabase access is disabled for security.');
}

// Создаем клиент только если есть переменные окружения
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Типы для TypeScript (опционально) - удалены для совместимости с .js файлом
