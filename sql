-- Создание таблицы video_tags с упрощенной структурой
CREATE TABLE IF NOT EXISTS video_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_video_tag UNIQUE (video_id, tag_id)
);

-- Включение row-level security
ALTER TABLE video_tags ENABLE ROW LEVEL SECURITY;

-- Добавление столбца avatar_url в таблицу users, если он не существует
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'users' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE users ADD COLUMN avatar_url TEXT;
        RAISE NOTICE 'Добавлен столбец avatar_url в таблицу users';
    END IF;
END $$;

-- Добавление столбца display_name в таблицу users, если он не существует
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'users' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE users ADD COLUMN display_name TEXT;
        RAISE NOTICE 'Добавлен столбец display_name в таблицу users';
    END IF;
END $$;

-- Удаление всех существующих политик для таблицы users
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'users'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON users';
        RAISE NOTICE 'Удалена политика: %', policy_record.policyname;
    END LOOP;
END $$;

-- Создание упрощенных политик для users
CREATE POLICY public_read_users ON users FOR SELECT USING (true);
CREATE POLICY public_insert_users ON users FOR INSERT WITH CHECK (true);
CREATE POLICY public_update_users ON users FOR UPDATE USING (true);

-- Удаление всех существующих политик для таблицы videos
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'videos'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON videos';
        RAISE NOTICE 'Удалена политика: %', policy_record.policyname;
    END LOOP;
END $$;

-- Создание упрощенных политик для videos
CREATE POLICY public_read_videos ON videos FOR SELECT USING (true);
CREATE POLICY public_insert_videos ON videos FOR INSERT WITH CHECK (true);
CREATE POLICY public_update_videos ON videos FOR UPDATE USING (true);
CREATE POLICY public_delete_videos ON videos FOR DELETE USING (true);

-- Удаление всех существующих политик для таблицы likes
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'likes'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON likes';
        RAISE NOTICE 'Удалена политика: %', policy_record.policyname;
    END LOOP;
END $$;

-- Создание упрощенных политик для likes
CREATE POLICY public_read_likes ON likes FOR SELECT USING (true);
CREATE POLICY public_insert_likes ON likes FOR INSERT WITH CHECK (true);
CREATE POLICY public_delete_likes ON likes FOR DELETE USING (true);

-- Удаление всех существующих политик для таблицы tags
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'tags'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON tags';
        RAISE NOTICE 'Удалена политика: %', policy_record.policyname;
    END LOOP;
END $$;

-- Создание упрощенных политик для tags
CREATE POLICY public_read_tags ON tags FOR SELECT USING (true);
CREATE POLICY public_insert_tags ON tags FOR INSERT WITH CHECK (true);
CREATE POLICY public_delete_tags ON tags FOR DELETE USING (true);

-- Удаление всех существующих политик для таблицы video_tags
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'video_tags'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON video_tags';
        RAISE NOTICE 'Удалена политика: %', policy_record.policyname;
    END LOOP;
END $$;

-- Создание упрощенных политик для video_tags
CREATE POLICY public_read_video_tags ON video_tags FOR SELECT USING (true);
CREATE POLICY public_insert_video_tags ON video_tags FOR INSERT WITH CHECK (true);
CREATE POLICY public_delete_video_tags ON video_tags FOR DELETE USING (true);

-- Удаление всех существующих политик для storage.objects (для всех бакетов: videos, avatars, thumbnails)
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON storage.objects';
        RAISE NOTICE 'Удалена политика: %', policy_record.policyname;
    END LOOP;
END $$;

-- Создание политик для бакета videos
CREATE POLICY public_read_videos_storage ON storage.objects FOR SELECT 
    USING (bucket_id = 'geoclips-videos');
CREATE POLICY public_insert_videos_storage ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'geoclips-videos');
CREATE POLICY public_update_videos_storage ON storage.objects FOR UPDATE 
    USING (bucket_id = 'geoclips-videos');
CREATE POLICY public_delete_videos_storage ON storage.objects FOR DELETE 
    USING (bucket_id = 'geoclips-videos');

-- Создание политик для бакета avatars
CREATE POLICY public_read_avatars_storage ON storage.objects FOR SELECT 
    USING (bucket_id = 'geoclips-avatars');
CREATE POLICY public_insert_avatars_storage ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'geoclips-avatars');
CREATE POLICY public_update_avatars_storage ON storage.objects FOR UPDATE 
    USING (bucket_id = 'geoclips-avatars');
CREATE POLICY public_delete_avatars_storage ON storage.objects FOR DELETE 
    USING (bucket_id = 'geoclips-avatars');

-- Создание политик для бакета thumbnails
CREATE POLICY public_read_thumbnails_storage ON storage.objects FOR SELECT 
    USING (bucket_id = 'geoclips-thumbnails');
CREATE POLICY public_insert_thumbnails_storage ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'geoclips-thumbnails');
CREATE POLICY public_update_thumbnails_storage ON storage.objects FOR UPDATE 
    USING (bucket_id = 'geoclips-thumbnails');
CREATE POLICY public_delete_thumbnails_storage ON storage.objects FOR DELETE 
    USING (bucket_id = 'geoclips-thumbnails');

-- Удаление всех существующих политик для storage.buckets
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'buckets'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON storage.buckets';
        RAISE NOTICE 'Удалена политика: %', policy_record.policyname;
    END LOOP;
END $$;

-- Создание упрощенных политик для buckets
CREATE POLICY public_read_buckets ON storage.buckets FOR SELECT USING (true);
CREATE POLICY public_insert_buckets ON storage.buckets FOR INSERT WITH CHECK (true);

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_users_yandex_id ON users(yandex_id);
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_video_id ON likes(video_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_video_tags_video_id ON video_tags(video_id);
CREATE INDEX IF NOT EXISTS idx_video_tags_tag_id ON video_tags(tag_id);

-- Создание функции upsert_user
CREATE OR REPLACE FUNCTION upsert_user(
    p_yandex_id VARCHAR(255),
    p_first_name VARCHAR(100),
    p_last_name VARCHAR(100),
    p_display_name VARCHAR(100),
    p_avatar_url TEXT
) RETURNS TABLE (
    id UUID,
    yandex_id VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO users (
        yandex_id, first_name, last_name, display_name, avatar_url, created_at, updated_at
    ) VALUES (
        p_yandex_id, p_first_name, p_last_name, p_display_name, p_avatar_url, NOW(), NOW()
    ) ON CONFLICT (yandex_id) 
    DO UPDATE SET
        first_name = COALESCE(EXCLUDED.first_name, users.first_name),
        last_name = COALESCE(EXCLUDED.last_name, users.last_name),
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
        updated_at = NOW()
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- Добавление столбца views_count в таблицу videos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'videos' 
        AND column_name = 'views_count'
    ) THEN
        ALTER TABLE videos ADD COLUMN views_count INTEGER NOT NULL DEFAULT 0;
        RAISE NOTICE 'Добавлен столбец views_count в таблицу videos';
    END IF;
END $$;

-- Создание таблицы video_views
CREATE TABLE IF NOT EXISTS video_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_video_view UNIQUE (video_id, user_id)
);

-- Включение row-level security для video_views
ALTER TABLE video_views ENABLE ROW LEVEL SECURITY;

-- Удаление всех существующих политик для video_views
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'video_views'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON video_views';
        RAISE NOTICE 'Удалена политика: %', policy_record.policyname;
    END LOOP;
END $$;

-- Создание политик для video_views
CREATE POLICY public_read_video_views ON video_views FOR SELECT USING (true);
CREATE POLICY public_insert_video_views ON video_views FOR INSERT WITH CHECK (true);
CREATE POLICY public_delete_video_views ON video_views FOR DELETE USING (true);

-- Создание индексов для video_views
CREATE INDEX IF NOT EXISTS idx_video_views_video_id ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_user_id ON video_views(user_id);
CREATE INDEX IF NOT EXISTS idx_video_views_created_at ON video_views(created_at);

-- Создание функций для триггеров views_count
CREATE OR REPLACE FUNCTION update_views_count_after_insert() 
RETURNS TRIGGER AS $$
BEGIN
    UPDATE videos SET views_count = views_count + 1 WHERE id = NEW.video_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_views_count_after_delete() 
RETURNS TRIGGER AS $$
BEGIN
    UPDATE videos SET views_count = GREATEST(views_count - 1, 0) WHERE id = OLD.video_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Удаление существующих триггеров, если они есть
DROP TRIGGER IF EXISTS video_views_after_insert ON video_views;
DROP TRIGGER IF EXISTS video_views_after_delete ON video_views;

-- Создание триггеров для views_count
CREATE TRIGGER video_views_after_insert
AFTER INSERT ON video_views
FOR EACH ROW EXECUTE FUNCTION update_views_count_after_insert();

CREATE TRIGGER video_views_after_delete
AFTER DELETE ON video_views
FOR EACH ROW EXECUTE FUNCTION update_views_count_after_delete();

-- Создание функции record_video_view
CREATE OR REPLACE FUNCTION record_video_view(p_video_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO video_views (video_id, user_id)
    VALUES (p_video_id, p_user_id)
    ON CONFLICT (video_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ТАБЛИЦА КОММЕНТАРИЕВ (безопасное создание + триггеры)
-- ============================================

-- 1) Создаём таблицу comments (если ещё нет)
CREATE TABLE IF NOT EXISTS comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL CHECK (char_length(text) >= 1 AND char_length(text) <= 1000),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Безопасно добавляем колонку updated_at, если её нет
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'comments' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE comments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Добавлен столбец updated_at в таблицу comments';
    END IF;
END $$;

-- 3) Включаем RLS (если нужно)
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 4) Удаляем все политики для comments и создаём простые
DO $$
DECLARE policy_record RECORD;
BEGIN
  FOR policy_record IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comments'
  ) LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON comments';
    RAISE NOTICE 'Удалена политика: %', policy_record.policyname;
  END LOOP;
END $$;

CREATE POLICY public_read_comments ON comments FOR SELECT USING (true);
CREATE POLICY public_insert_comments ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY public_update_comments ON comments FOR UPDATE USING (true);
CREATE POLICY public_delete_comments ON comments FOR DELETE USING (true);

-- 5) Индексы
CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- 6) Обновление comments_count в videos
CREATE OR REPLACE FUNCTION update_comments_count_after_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE videos SET comments_count = COALESCE(comments_count,0) + 1 WHERE id = NEW.video_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_comments_count_after_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE videos SET comments_count = GREATEST(COALESCE(comments_count,0) - 1, 0) WHERE id = OLD.video_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Удаляем старые триггеры comments_count, если есть
DROP TRIGGER IF EXISTS comments_after_insert ON comments;
DROP TRIGGER IF EXISTS comments_after_delete ON comments;

-- Создаём триггеры comments_count
CREATE TRIGGER comments_after_insert
AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION update_comments_count_after_insert();

CREATE TRIGGER comments_after_delete
AFTER DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION update_comments_count_after_delete();

-- 7) Удаляем старый триггер updated_at (ВАЖНО: делаем это ДО создания функции)
DROP TRIGGER IF EXISTS update_comments_updated_at_trigger ON comments;

-- 8) Создаём функцию для обновления updated_at с динамической проверкой
CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS TRIGGER AS $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    -- Проверяем существование колонки updated_at
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'comments' 
        AND column_name = 'updated_at'
    ) INTO column_exists;
    
    -- Если колонка существует, обновляем её через динамический SQL
    IF column_exists THEN
        EXECUTE format('UPDATE comments SET updated_at = NOW() WHERE id = $1') USING NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9) Создаём триггер AFTER UPDATE (не BEFORE)
CREATE TRIGGER update_comments_updated_at_trigger
AFTER UPDATE ON comments
FOR EACH ROW EXECUTE FUNCTION update_comments_updated_at();