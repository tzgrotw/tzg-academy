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
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 舊資料庫補這欄（軟刪除——後台誤刪可以從垃圾桶救回來，不是馬上真的砍掉）
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
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
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.course_chapters ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
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
--   影片三種來源（擇一）：storage_path＝自家空間、youtube_id＝YouTube（免費課用）、
--   cf_stream_id＝Cloudflare Stream（收費課用——簽名 token 播放，連結轉傳無效）
CREATE TABLE IF NOT EXISTS public.course_videos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chapter_key TEXT NOT NULL REFERENCES public.course_chapters(key) ON DELETE CASCADE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'video' CHECK (kind IN ('video','doc','image')),
  storage_path TEXT,
  youtube_id TEXT,
  cf_stream_id TEXT,
  duration_sec INT,
  sort_no INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 舊資料庫已經有這張表的話，補這幾欄（新資料庫上面 CREATE TABLE 就直接帶了，這幾行只是 no-op）
ALTER TABLE public.course_videos ADD COLUMN IF NOT EXISTS youtube_id TEXT;
ALTER TABLE public.course_videos ADD COLUMN IF NOT EXISTS cf_stream_id TEXT;
ALTER TABLE public.course_videos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.course_videos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY videos_read ON public.course_videos FOR SELECT
    USING ((is_active AND public.fn_can_access_chapter(chapter_key)) OR public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY videos_admin ON public.course_videos FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 測驗／作業（章節底下，跟教材平行）──────────────────────────────
--   quiz：選擇題，送出當下自動評分；assignment：上傳檔案，管理員手動審核
--   pass_pct：quiz 要答對幾 % 才算過（assignment 不看這欄）
CREATE TABLE IF NOT EXISTS public.course_assessments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chapter_key TEXT NOT NULL REFERENCES public.course_chapters(key) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('quiz','assignment')),
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  pass_pct INT NOT NULL DEFAULT 60,
  sort_no INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.course_assessments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.course_assessments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY assessments_read ON public.course_assessments FOR SELECT
    USING ((is_active AND public.fn_can_access_chapter(chapter_key)) OR public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY assessments_admin ON public.course_assessments FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 測驗題目——只有管理員跟 fn_quiz_questions() 讀得到 correct_index ──────
--   學員端一律走 fn_quiz_questions()／fn_submit_quiz()，不直接查這張表，
--   不然打開瀏覽器 Network 面板就能看到正確答案。
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assessment_id BIGINT NOT NULL REFERENCES public.course_assessments(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options TEXT[] NOT NULL DEFAULT '{}',
  correct_index INT NOT NULL DEFAULT 0,
  sort_no INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY quiz_questions_admin ON public.quiz_questions FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 學員看題目（不含正確答案）——能不能看這一章就能不能看這一章的題目
CREATE OR REPLACE FUNCTION public.fn_quiz_questions(p_assessment_id BIGINT)
RETURNS TABLE(id BIGINT, question TEXT, options TEXT[], sort_no INT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.question, q.options, q.sort_no
  FROM public.quiz_questions q
  JOIN public.course_assessments a ON a.id = q.assessment_id
  WHERE q.assessment_id = p_assessment_id
    AND (public.fn_can_access_chapter(a.chapter_key) OR public.fn_is_admin())
  ORDER BY q.sort_no
$$;

-- 交卷評分——answers 是 {"題目id": 選的選項index}，全部在伺服器端算，
-- 前端從頭到尾拿不到 correct_index。算完直接把結果寫進 assessment_submissions。
CREATE OR REPLACE FUNCTION public.fn_submit_quiz(p_assessment_id BIGINT, p_answers JSONB)
RETURNS TABLE(score_pct INT, passed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total INT; v_correct INT := 0; v_pass_pct INT; v_score INT; v_passed BOOLEAN;
  q RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.course_assessments a
    WHERE a.id = p_assessment_id AND a.kind = 'quiz'
      AND (public.fn_can_access_chapter(a.chapter_key) OR public.fn_is_admin())
  ) THEN
    RAISE EXCEPTION '沒有這份測驗，或沒有權限';
  END IF;

  SELECT pass_pct INTO v_pass_pct FROM public.course_assessments WHERE id = p_assessment_id;
  SELECT count(*) INTO v_total FROM public.quiz_questions WHERE assessment_id = p_assessment_id;
  IF v_total = 0 THEN RAISE EXCEPTION '這份測驗還沒有題目'; END IF;

  FOR q IN SELECT id, correct_index FROM public.quiz_questions WHERE assessment_id = p_assessment_id LOOP
    IF (p_answers->>(q.id::text))::int = q.correct_index THEN v_correct := v_correct + 1; END IF;
  END LOOP;

  v_score := round(v_correct * 100.0 / v_total);
  v_passed := v_score >= v_pass_pct;

  INSERT INTO public.assessment_submissions (user_id, assessment_id, answers, score_pct, status, submitted_at, reviewed_at)
  VALUES (auth.uid(), p_assessment_id, p_answers, v_score, CASE WHEN v_passed THEN 'passed' ELSE 'failed' END, now(), now())
  ON CONFLICT (user_id, assessment_id) DO UPDATE
    SET answers = EXCLUDED.answers, score_pct = EXCLUDED.score_pct, status = EXCLUDED.status,
        submitted_at = EXCLUDED.submitted_at, reviewed_at = EXCLUDED.reviewed_at, feedback = NULL;

  RETURN QUERY SELECT v_score, v_passed;
END $$;

-- 作業送出——強制 status='pending'，不讓學員自己把狀態改成 passed。
CREATE OR REPLACE FUNCTION public.fn_submit_assignment(p_assessment_id BIGINT, p_file_path TEXT, p_note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.course_assessments a
    WHERE a.id = p_assessment_id AND a.kind = 'assignment'
      AND (public.fn_can_access_chapter(a.chapter_key) OR public.fn_is_admin())
  ) THEN
    RAISE EXCEPTION '沒有這份作業，或沒有權限';
  END IF;

  INSERT INTO public.assessment_submissions (user_id, assessment_id, file_path, note, status, submitted_at)
  VALUES (auth.uid(), p_assessment_id, p_file_path, p_note, 'pending', now())
  ON CONFLICT (user_id, assessment_id) DO UPDATE
    SET file_path = EXCLUDED.file_path, note = EXCLUDED.note, status = 'pending',
        submitted_at = now(), reviewed_at = NULL, feedback = NULL;
END $$;

-- ── 測驗/作業的作答與提交紀錄（一人一份一列）────────────────────────
--   quiz：answers/score_pct 由 fn_submit_quiz 寫入；assignment：file_path/note 由 fn_submit_assignment 寫入
--   status：pending（作業待審）／passed／failed——「這一章算不算修完」看這欄
CREATE TABLE IF NOT EXISTS public.assessment_submissions (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id BIGINT NOT NULL REFERENCES public.course_assessments(id) ON DELETE CASCADE,
  answers JSONB,
  score_pct INT,
  file_path TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','passed','failed')),
  feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, assessment_id)
);
ALTER TABLE public.assessment_submissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY submissions_read ON public.assessment_submissions FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY submissions_admin_grade ON public.assessment_submissions FOR UPDATE TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- 沒有給學員的 INSERT/UPDATE policy——一律走上面兩個 SECURITY DEFINER 函式，
-- 不然學員能直接把自己的 status 改成 passed。

-- 作業檔案：學員只能傳到自己 user_id 開頭的路徑，也只看得到自己的；管理員看全部
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('assignment-submissions', 'assignment-submissions', false, 52428800)
ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  CREATE POLICY assignment_upload_own ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'assignment-submissions' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY assignment_read_own_or_admin ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'assignment-submissions' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.fn_is_admin()));
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
-- 管理員看得到大家的進度（後台會員詳細頁用）——只能看，寫入還是只有本人
DO $$ BEGIN
  CREATE POLICY progress_admin_read ON public.video_progress FOR SELECT TO authenticated
    USING (public.fn_is_admin());
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
