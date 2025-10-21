import { createClient } from '@supabase/supabase-js';

// Используем переменные окружения для конфигурации
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://dfzlheyjqazpwqtiqdsp.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmemxoZXlqcWF6cHdxdGlxZHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NDA5NTUsImV4cCI6MjA3NjAxNjk1NX0.OBc35yo7lXt4sv7zOPPyKegP9nqDUOVqRGaVPy8cjiE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Типы для TypeScript (опционально) - удалены для совместимости с .js файлом
