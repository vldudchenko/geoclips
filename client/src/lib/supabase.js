import { createClient } from '@supabase/supabase-js';

// Используем переменные окружения для конфигурации
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://dfzlheyjqazpwqtiqdsp.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmemxoZXlqcWF6cHdxdGlxZHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NDA5NTUsImV4cCI6MjA3NjAxNjk1NX0.OBc35yo7lXt4sv7zOPPyKegP9nqDUOVqRGaVPy8cjiE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Типы для TypeScript (опционально)
export interface Video {
  id: string;
  user_id: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  latitude: number;
  longitude: number;
  duration_seconds?: number;
  likes_count: number;
  views_count: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  yandex_id: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  avatar_url?: string;
  total_likes: number;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  usage_count: number;
  created_at: string;
}
