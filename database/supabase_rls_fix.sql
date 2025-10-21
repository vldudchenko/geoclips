-- =====================================================
-- ИСПРАВЛЕНИЕ RLS ПОЛИТИК ДЛЯ SUPABASE
-- Версия: 2.1.0
-- Дата: 19 октября 2024
-- =====================================================

-- =====================================================
-- 1. СОЗДАНИЕ ТАБЛИЦЫ VIDEO_TAGS
-- =====================================================

-- Создаем таблицу video_tags если её нет
CREATE TABLE IF NOT EXISTS video_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(video_id, tag_id)
);

-- Включаем RLS для таблицы video_tags
ALTER TABLE video_tags ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. ПРОВЕРКА И СОЗДАНИЕ ПОЛЕЙ
-- =====================================================

-- Проверяем и добавляем поле avatar_url если его нет
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'avatar_url'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN avatar_url TEXT;
        RAISE NOTICE '✅ Добавлено поле avatar_url в таблицу users';
    ELSE
        RAISE NOTICE '✅ Поле avatar_url уже существует';
    END IF;
END $$;

-- Проверяем и добавляем поле display_name если его нет
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'display_name'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN display_name TEXT;
        RAISE NOTICE '✅ Добавлено поле display_name в таблицу users';
    ELSE
        RAISE NOTICE '✅ Поле display_name уже существует';
    END IF;
END $$;

-- =====================================================
-- 3. ТАБЛИЦА USERS - RLS ПОЛИТИКИ
-- =====================================================

-- Удаляем все старые политики
DROP POLICY IF EXISTS "Allow user creation for Yandex OAuth" ON users;
DROP POLICY IF EXISTS "Users are viewable by everyone" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert" ON users;
DROP POLICY IF EXISTS "Users can select" ON users;
DROP POLICY IF EXISTS "Users can update" ON users;
DROP POLICY IF EXISTS "Public read access for users" ON users;
DROP POLICY IF EXISTS "Public insert access for users" ON users;
DROP POLICY IF EXISTS "Public update access for users" ON users;

-- Создаем новые политики
CREATE POLICY "Public read access for users"
ON users FOR SELECT
USING (true);

CREATE POLICY "Public insert access for users"
ON users FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public update access for users"
ON users FOR UPDATE
USING (true);

-- =====================================================
-- 4. ТАБЛИЦА VIDEOS - RLS ПОЛИТИКИ
-- =====================================================

DROP POLICY IF EXISTS "Videos are viewable by everyone" ON videos;
DROP POLICY IF EXISTS "Allow video creation" ON videos;
DROP POLICY IF EXISTS "Users can update own videos" ON videos;
DROP POLICY IF EXISTS "Users can delete own videos" ON videos;
DROP POLICY IF EXISTS "Public read access for videos" ON videos;
DROP POLICY IF EXISTS "Public insert access for videos" ON videos;
DROP POLICY IF EXISTS "Public update access for videos" ON videos;
DROP POLICY IF EXISTS "Public delete access for videos" ON videos;

CREATE POLICY "Public read access for videos"
ON videos FOR SELECT
USING (true);

CREATE POLICY "Public insert access for videos"
ON videos FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public update access for videos"
ON videos FOR UPDATE
USING (true);

CREATE POLICY "Public delete access for videos"
ON videos FOR DELETE
USING (true);

-- =====================================================
-- 5. ТАБЛИЦА LIKES - RLS ПОЛИТИКИ
-- =====================================================

DROP POLICY IF EXISTS "Likes are viewable by everyone" ON likes;
DROP POLICY IF EXISTS "Allow like creation" ON likes;
DROP POLICY IF EXISTS "Allow like removal" ON likes;
DROP POLICY IF EXISTS "Public read access for likes" ON likes;
DROP POLICY IF EXISTS "Public insert access for likes" ON likes;
DROP POLICY IF EXISTS "Public delete access for likes" ON likes;

CREATE POLICY "Public read access for likes"
ON likes FOR SELECT
USING (true);

CREATE POLICY "Public insert access for likes"
ON likes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public delete access for likes"
ON likes FOR DELETE
USING (true);

-- =====================================================
-- 6. ТАБЛИЦА TAGS - RLS ПОЛИТИКИ
-- =====================================================

DROP POLICY IF EXISTS "Tags are viewable by everyone" ON tags;
DROP POLICY IF EXISTS "Allow tag creation" ON tags;
DROP POLICY IF EXISTS "Public read access for tags" ON tags;
DROP POLICY IF EXISTS "Public insert access for tags" ON tags;

CREATE POLICY "Public read access for tags"
ON tags FOR SELECT
USING (true);

CREATE POLICY "Public insert access for tags"
ON tags FOR INSERT
WITH CHECK (true);

-- =====================================================
-- 7. ТАБЛИЦА VIDEO_TAGS - RLS ПОЛИТИКИ
-- =====================================================

DROP POLICY IF EXISTS "Video tags are viewable by everyone" ON video_tags;
DROP POLICY IF EXISTS "Allow video tag creation" ON video_tags;
DROP POLICY IF EXISTS "Allow video tag removal" ON video_tags;
DROP POLICY IF EXISTS "Public read access for video_tags" ON video_tags;
DROP POLICY IF EXISTS "Public insert access for video_tags" ON video_tags;
DROP POLICY IF EXISTS "Public delete access for video_tags" ON video_tags;

CREATE POLICY "Public read access for video_tags"
ON video_tags FOR SELECT
USING (true);

CREATE POLICY "Public insert access for video_tags"
ON video_tags FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public delete access for video_tags"
ON video_tags FOR DELETE
USING (true);

-- =====================================================
-- 8. STORAGE - ВИДЕО (geoclips-videos)
-- =====================================================

DROP POLICY IF EXISTS "Public Access for videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow video upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow video deletion" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for videos storage" ON storage.objects;
DROP POLICY IF EXISTS "Public insert access for videos storage" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access for videos storage" ON storage.objects;
DROP POLICY IF EXISTS "Public update access for videos storage" ON storage.objects;

-- Создаем политики для видео
CREATE POLICY "Public read access for videos storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'geoclips-videos');

CREATE POLICY "Public insert access for videos storage"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'geoclips-videos');

CREATE POLICY "Public update access for videos storage"
ON storage.objects FOR UPDATE
USING (bucket_id = 'geoclips-videos');

CREATE POLICY "Public delete access for videos storage"
ON storage.objects FOR DELETE
USING (bucket_id = 'geoclips-videos');

-- =====================================================
-- 9. STORAGE - АВАТАРЫ (geoclips-avatars)
-- =====================================================

DROP POLICY IF EXISTS "Public read access for avatars storage" ON storage.objects;
DROP POLICY IF EXISTS "Public insert access for avatars storage" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access for avatars storage" ON storage.objects;
DROP POLICY IF EXISTS "Public update access for avatars storage" ON storage.objects;

-- Создаем политики для аватаров
CREATE POLICY "Public read access for avatars storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'geoclips-avatars');

CREATE POLICY "Public insert access for avatars storage"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'geoclips-avatars');

CREATE POLICY "Public update access for avatars storage"
ON storage.objects FOR UPDATE
USING (bucket_id = 'geoclips-avatars');

CREATE POLICY "Public delete access for avatars storage"
ON storage.objects FOR DELETE
USING (bucket_id = 'geoclips-avatars');

-- =====================================================
-- 10. STORAGE - ПРЕВЬЮ (geoclips-thumbnails)
-- =====================================================

DROP POLICY IF EXISTS "Public read access for thumbnails storage" ON storage.objects;
DROP POLICY IF EXISTS "Public insert access for thumbnails storage" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access for thumbnails storage" ON storage.objects;
DROP POLICY IF EXISTS "Public update access for thumbnails storage" ON storage.objects;

-- Создаем политики для превью
CREATE POLICY "Public read access for thumbnails storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'geoclips-thumbnails');

CREATE POLICY "Public insert access for thumbnails storage"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'geoclips-thumbnails');

CREATE POLICY "Public update access for thumbnails storage"
ON storage.objects FOR UPDATE
USING (bucket_id = 'geoclips-thumbnails');

CREATE POLICY "Public delete access for thumbnails storage"
ON storage.objects FOR DELETE
USING (bucket_id = 'geoclips-thumbnails');

-- =====================================================
-- 11. STORAGE BUCKETS - ПОЛИТИКИ
-- =====================================================

-- Проверяем статус RLS для buckets
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'storage' 
        AND tablename = 'buckets'
    ) THEN
        RAISE NOTICE '✅ Таблица storage.buckets существует';
    END IF;
END $$;

-- Удаляем старые политики для buckets
DROP POLICY IF EXISTS "Public bucket creation" ON storage.buckets;
DROP POLICY IF EXISTS "Public bucket read" ON storage.buckets;
DROP POLICY IF EXISTS "Allow bucket creation" ON storage.buckets;
DROP POLICY IF EXISTS "Allow bucket read" ON storage.buckets;
DROP POLICY IF EXISTS "Public access for buckets" ON storage.buckets;

-- Создаем политики для buckets
CREATE POLICY "Public bucket read"
ON storage.buckets FOR SELECT
USING (true);

CREATE POLICY "Public bucket creation"
ON storage.buckets FOR INSERT
WITH CHECK (true);

-- =====================================================
-- 12. ПРОВЕРКА РЕЗУЛЬТАТОВ
-- =====================================================

-- Проверяем структуру таблицы users
SELECT 
    '✅ Структура users:' as info,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Проверяем политики для public таблиц
SELECT 
    '✅ Политики public таблиц:' as info,
    tablename, 
    policyname, 
    cmd 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Проверяем политики для storage
SELECT 
    '✅ Политики storage:' as info,
    tablename, 
    policyname, 
    cmd 
FROM pg_policies 
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;

-- Проверяем существующих пользователей
SELECT 
    '✅ Пользователи (последние 5):' as info,
    id,
    yandex_id,
    display_name,
    first_name,
    last_name,
    avatar_url,
    created_at
FROM users 
ORDER BY created_at DESC 
LIMIT 5;

-- =====================================================
-- 13. ДОПОЛНИТЕЛЬНЫЕ ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- =====================================================

-- Индекс для поиска пользователя по yandex_id
CREATE INDEX IF NOT EXISTS idx_users_yandex_id ON users(yandex_id);

-- Индекс для поиска видео по пользователю
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);

-- Индекс для лайков
CREATE INDEX IF NOT EXISTS idx_likes_video_id ON likes(video_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);

-- Индекс для тегов видео
CREATE INDEX IF NOT EXISTS idx_video_tags_video_id ON video_tags(video_id);
CREATE INDEX IF NOT EXISTS idx_video_tags_tag_id ON video_tags(tag_id);

-- =====================================================
-- ✅ СКРИПТ ЗАВЕРШЕН
-- =====================================================