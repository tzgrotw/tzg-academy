-- ═══════════════════════════════════════════════════════════════════
-- 泰熙爾札娜學院（TZG Academy）——整份資料庫底座
-- 用法：開一個全新的 Supabase 專案 → SQL Editor → 整份貼上執行。
-- 重複跑不會壞事（都有 IF NOT EXISTS / OR REPLACE / 例外處理）。
-- ═══════════════════════════════════════════════════════════════════

-- ── 會員檔案：一人一列，tier 分級 ────────────────────────────────
--   member＝免費註冊的會員（看 public＋member 課）
--   agent ＝代理（再多看 agent 課）
--   admin ＝管理員（建課＋管會員）
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  tier TEXT NOT NULL DEFAULT 'member' CHECK (tier IN ('member','agent','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 註冊時自動開檔（name 從註冊表單的 metadata 帶進來）
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name)
  VALUES (NEW.id, COALESCE(NEW.email,''), COALESCE(NEW.raw_user_meta_data->>'name',''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

CREATE OR REPLACE FUNCTION public.fn_my_tier()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT tier FROM public.profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.fn_is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT tier = 'admin' FROM public.profiles WHERE user_id = auth.uid()), false)
$$;

DO $$ BEGIN
  CREATE POLICY profiles_read_own ON public.profiles FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY profiles_update_own_name ON public.profiles FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND tier = public.fn_my_tier());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 課程 ────────────────────────────────────────────────────────
--   audience：public＝不登入也看得到內容頁；member＝會員；agent＝代理專屬
--   課名/封面對所有人可見（目錄要能顯示上鎖卡），內容（小節/影片）才鎖
CREATE TABLE IF NOT EXISTS public.courses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT 'public' CHECK (audience IN ('public','member','agent')),
  cover_url TEXT,
  sort_no INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY courses_read ON public.courses FOR SELECT
    USING (is_active OR public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY courses_admin ON public.courses FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 章節 ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_chapters (
  key TEXT PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  sort_no INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.course_chapters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY chapters_read ON public.course_chapters FOR SELECT
    USING (is_active OR public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY chapters_admin ON public.course_chapters FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 「這個人能不能看這門課的內容」——小節/影片/檔案的守門邏輯只有這一份
CREATE OR REPLACE FUNCTION public.fn_can_access_course(p_course BIGINT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.fn_is_admin() THEN true
    WHEN c.audience = 'public' THEN true
    WHEN c.audience = 'member' THEN public.fn_my_tier() IN ('member','agent')
    WHEN c.audience = 'agent'  THEN public.fn_my_tier() = 'agent'
    ELSE false END
  FROM public.courses c WHERE c.id = p_course
$$;

CREATE OR REPLACE FUNCTION public.fn_can_access_chapter(p_key TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.fn_can_access_course(ch.course_id)
  FROM public.course_chapters ch WHERE ch.key = p_key
$$;

-- ── 小節內文 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_sections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chapter_key TEXT NOT NULL REFERENCES public.course_chapters(key) ON DELETE CASCADE,
  heading TEXT NOT NULL,
  items TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  sort_no INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY sections_read ON public.course_sections FOR SELECT
    USING ((is_active AND public.fn_can_access_chapter(chapter_key)) OR public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY sections_admin ON public.course_sections FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 教材（影片/講義/圖片）────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_videos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chapter_key TEXT NOT NULL REFERENCES public.course_chapters(key) ON DELETE CASCADE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'video' CHECK (kind IN ('video','doc','image')),
  storage_path TEXT,
  youtube_id TEXT,
  duration_sec INT,
  sort_no INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 舊資料庫已經有這張表的話，補這欄（新資料庫上面 CREATE TABLE 就直接帶了，這行只是 no-op）
ALTER TABLE public.course_videos ADD COLUMN IF NOT EXISTS youtube_id TEXT;
ALTER TABLE public.course_videos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY videos_read ON public.course_videos FOR SELECT
    USING ((is_active AND public.fn_can_access_chapter(chapter_key)) OR public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY videos_admin ON public.course_videos FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 觀看進度（一人一支一列；看到 95% 算看完）───────────────────────
CREATE TABLE IF NOT EXISTS public.video_progress (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id BIGINT NOT NULL REFERENCES public.course_videos(id) ON DELETE CASCADE,
  pct INT NOT NULL DEFAULT 0,
  last_sec INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY progress_own ON public.video_progress FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 我的筆記（一人一章一份，只有自己看得到）────────────────────────
CREATE TABLE IF NOT EXISTS public.course_notes (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_key TEXT NOT NULL REFERENCES public.course_chapters(key) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chapter_key)
);
ALTER TABLE public.course_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY notes_own ON public.course_notes FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 里程碑獎勵＋證書文案（after_chapter NULL＝結業證書）─────────────
CREATE TABLE IF NOT EXISTS public.course_rewards (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  after_chapter TEXT REFERENCES public.course_chapters(key) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.course_rewards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY rewards_read ON public.course_rewards FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY rewards_admin ON public.course_rewards FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 圖庫：教材（私有，簽名網址播放）＋封面（公開）──────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('course-videos', 'course-videos', false, 524288000)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-covers', 'course-covers', true)
ON CONFLICT (id) DO NOTHING;

-- 教材檔：能看那一章的人才簽得到網址；上傳/刪除只有管理員
DO $$ BEGIN
  CREATE POLICY academy_videos_read ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'course-videos' AND EXISTS (
      SELECT 1 FROM public.course_videos v
      WHERE v.storage_path = storage.objects.name AND public.fn_can_access_chapter(v.chapter_key)
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY academy_videos_write ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'course-videos' AND public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY academy_videos_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'course-videos' AND public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 封面：全世界看得到；上傳/換圖/刪除只有管理員
DO $$ BEGIN
  CREATE POLICY academy_covers_read ON storage.objects FOR SELECT
    USING (bucket_id = 'course-covers');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY academy_covers_write ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'course-covers' AND public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY academy_covers_update ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'course-covers' AND public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY academy_covers_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'course-covers' AND public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 跑完之後，老闆把自己升成管理員（email 換成你註冊用的信箱）：
--   UPDATE public.profiles SET tier = 'admin' WHERE email = 'you@example.com';
-- ═══════════════════════════════════════════════════════════════════
