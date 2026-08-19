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
DROP POLICY IF EXISTS courses_read ON public.courses;
CREATE POLICY courses_read ON public.courses FOR SELECT
  USING ((is_active AND deleted_at IS NULL) OR public.fn_is_admin());
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
DROP POLICY IF EXISTS chapters_read ON public.course_chapters;
CREATE POLICY chapters_read ON public.course_chapters FOR SELECT
  USING ((is_active AND deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_chapters.course_id AND c.is_active AND c.deleted_at IS NULL
  )) OR public.fn_is_admin());
DO $$ BEGIN
  CREATE POLICY chapters_admin ON public.course_chapters FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 「這個人能不能看這門課的內容」——小節/影片/檔案的守門邏輯只有這一份
CREATE OR REPLACE FUNCTION public.fn_can_access_course(p_course BIGINT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.fn_is_admin() THEN true
    WHEN NOT c.is_active OR c.deleted_at IS NOT NULL THEN false
    WHEN c.audience = 'public' THEN true
    WHEN c.audience = 'member' THEN public.fn_my_tier() IN ('member','agent')
    WHEN c.audience = 'agent'  THEN public.fn_my_tier() = 'agent'
    ELSE false END
  FROM public.courses c WHERE c.id = p_course
$$;

CREATE OR REPLACE FUNCTION public.fn_can_access_chapter(p_key TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT ch.is_active AND ch.deleted_at IS NULL AND public.fn_can_access_course(ch.course_id)
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
DROP POLICY IF EXISTS videos_read ON public.course_videos;
CREATE POLICY videos_read ON public.course_videos FOR SELECT
  USING ((is_active AND deleted_at IS NULL AND public.fn_can_access_chapter(chapter_key)) OR public.fn_is_admin());
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
DROP POLICY IF EXISTS assessments_read ON public.course_assessments;
CREATE POLICY assessments_read ON public.course_assessments FOR SELECT
  USING ((is_active AND deleted_at IS NULL AND public.fn_can_access_chapter(chapter_key)) OR public.fn_is_admin());
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
    AND a.is_active
    AND a.deleted_at IS NULL
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
      AND a.is_active AND a.deleted_at IS NULL
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
      AND a.is_active AND a.deleted_at IS NULL
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
  pct INT NOT NULL DEFAULT 0 CHECK (pct BETWEEN 0 AND 100),
  last_sec INT NOT NULL DEFAULT 0 CHECK (last_sec >= 0),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;
-- 進度只能寫到本人有權觀看、且仍上架的影片；避免跨課程偽造進度。
-- 舊專案可能已有同名 policy，這裡明確重建，確保重跑 schema 會套用最新版守門規則。
DROP POLICY IF EXISTS progress_own ON public.video_progress;
CREATE POLICY progress_own ON public.video_progress FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND pct BETWEEN 0 AND 100
    AND last_sec >= 0
    AND EXISTS (
      SELECT 1 FROM public.course_videos v
      WHERE v.id = video_id
        AND v.is_active
        AND v.deleted_at IS NULL
        AND public.fn_can_access_chapter(v.chapter_key)
    )
  );
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
DROP POLICY IF EXISTS rewards_read ON public.course_rewards;
CREATE POLICY rewards_read ON public.course_rewards FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_rewards.course_id AND c.is_active AND c.deleted_at IS NULL
  ) OR public.fn_is_admin()
);
DO $$ BEGIN
  CREATE POLICY rewards_admin ON public.course_rewards FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 正式電子證書（完成條件由資料庫驗證，前端不能自行核發）────────────
CREATE TABLE IF NOT EXISTS public.course_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_no TEXT NOT NULL UNIQUE,
  verification_code UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  course_id BIGINT NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  learner_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  certificate_title TEXT NOT NULL DEFAULT '結業證書',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  UNIQUE (user_id, course_id)
);
ALTER TABLE public.course_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS certificates_read_own_or_admin ON public.course_certificates;
CREATE POLICY certificates_read_own_or_admin ON public.course_certificates FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.fn_is_admin());
DROP POLICY IF EXISTS certificates_admin_update ON public.course_certificates;
CREATE POLICY certificates_admin_update ON public.course_certificates FOR UPDATE TO authenticated
  USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

-- 使用伺服器端資料判斷是否修畢：至少有一份有效教材／評量；影片全達 95%；評量全通過。
CREATE OR REPLACE FUNCTION public.fn_course_completed(p_course BIGINT, p_user UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = p_course AND c.is_active AND c.deleted_at IS NULL
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.course_videos v
      JOIN public.course_chapters ch ON ch.key = v.chapter_key
      WHERE ch.course_id = p_course AND ch.is_active AND ch.deleted_at IS NULL
        AND v.is_active AND v.deleted_at IS NULL AND v.kind = 'video'
    )
    OR EXISTS (
      SELECT 1 FROM public.course_assessments a
      JOIN public.course_chapters ch ON ch.key = a.chapter_key
      WHERE ch.course_id = p_course AND ch.is_active AND ch.deleted_at IS NULL
        AND a.is_active AND a.deleted_at IS NULL
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.course_videos v
    JOIN public.course_chapters ch ON ch.key = v.chapter_key
    WHERE ch.course_id = p_course AND ch.is_active AND ch.deleted_at IS NULL
      AND v.is_active AND v.deleted_at IS NULL AND v.kind = 'video'
      AND NOT EXISTS (
        SELECT 1 FROM public.video_progress vp
        WHERE vp.user_id = p_user AND vp.video_id = v.id AND vp.pct >= 95
      )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.course_assessments a
    JOIN public.course_chapters ch ON ch.key = a.chapter_key
    WHERE ch.course_id = p_course AND ch.is_active AND ch.deleted_at IS NULL
      AND a.is_active AND a.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.assessment_submissions s
        WHERE s.user_id = p_user AND s.assessment_id = a.id AND s.status = 'passed'
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.fn_issue_certificate(p_course BIGINT)
RETURNS TABLE(certificate_no TEXT, verification_code UUID, course_id BIGINT, learner_name TEXT, course_title TEXT,
  certificate_title TEXT, issued_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_name TEXT; v_course_title TEXT; v_certificate_title TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION '請先登入'; END IF;
  IF NOT public.fn_can_access_course(p_course) THEN RAISE EXCEPTION '沒有這門課的權限'; END IF;
  IF NOT public.fn_course_completed(p_course, v_user) THEN RAISE EXCEPTION '尚未符合結業條件'; END IF;

  SELECT COALESCE(NULLIF(p.name, ''), NULLIF(p.email, ''), 'TZG 學員') INTO v_name
  FROM public.profiles p WHERE p.user_id = v_user;
  SELECT c.title INTO v_course_title FROM public.courses c WHERE c.id = p_course;
  SELECT COALESCE(r.title, '結業證書') INTO v_certificate_title
  FROM public.course_rewards r WHERE r.course_id = p_course AND r.after_chapter IS NULL LIMIT 1;
  v_certificate_title := COALESCE(v_certificate_title, '結業證書');

  INSERT INTO public.course_certificates
    (certificate_no, user_id, course_id, learner_name, course_title, certificate_title)
  VALUES
    ('TZG-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
     v_user, p_course, v_name, v_course_title, v_certificate_title)
  ON CONFLICT (user_id, course_id) DO NOTHING;

  RETURN QUERY
  SELECT cc.certificate_no, cc.verification_code, cc.course_id, cc.learner_name, cc.course_title,
    cc.certificate_title, cc.issued_at, cc.revoked_at
  FROM public.course_certificates cc WHERE cc.user_id = v_user AND cc.course_id = p_course;
END $$;

-- 公開驗證只回傳證書必要欄位，不暴露 email、user_id 或其他會員資料。
CREATE OR REPLACE FUNCTION public.fn_verify_certificate(p_code TEXT)
RETURNS TABLE(certificate_no TEXT, learner_name TEXT, course_title TEXT, certificate_title TEXT,
  issued_at TIMESTAMPTZ, valid BOOLEAN, revoked_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT cc.certificate_no, cc.learner_name, cc.course_title, cc.certificate_title,
    cc.issued_at, cc.revoked_at IS NULL, cc.revoked_at
  FROM public.course_certificates cc
  WHERE cc.verification_code::text = p_code OR upper(cc.certificate_no) = upper(p_code)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.fn_course_completed(BIGINT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_issue_certificate(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_verify_certificate(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_issue_certificate(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_verify_certificate(TEXT) TO anon, authenticated;

-- ── 圖庫：教材（私有，簽名網址播放）＋封面（公開）──────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('course-videos', 'course-videos', false, 524288000)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-covers', 'course-covers', true)
ON CONFLICT (id) DO NOTHING;

-- 教材檔：能看那一章的人才簽得到網址；上傳/刪除只有管理員
DROP POLICY IF EXISTS academy_videos_read ON storage.objects;
CREATE POLICY academy_videos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-videos' AND EXISTS (
    SELECT 1 FROM public.course_videos v
    WHERE v.storage_path = storage.objects.name
      AND v.is_active
      AND v.deleted_at IS NULL
      AND public.fn_can_access_chapter(v.chapter_key)
  ));
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
-- Marketplace：講師、線下服務、預約、訂單、分潤
-- 商業模式：吸收女性講師的課上平台賣，平台抽 10%；
-- 學員線上看完課 → 站內預約講師的線下服務；講師互發推薦連結導流抽成。
-- ═══════════════════════════════════════════════════════════════════

-- ── 講師（平台代管內容；user_id 預留給日後講師自助後台）──────────────
CREATE TABLE IF NOT EXISTS public.instructors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  headline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  cover_url TEXT,
  line_url TEXT NOT NULL DEFAULT '',
  ig_url TEXT NOT NULL DEFAULT '',
  referral_code TEXT NOT NULL UNIQUE,
  -- 分潤比例存「這位講師」身上（談約可以一人一價）；平台預設 90/10、推薦抽 10 從講師份額出
  revenue_share_pct INT NOT NULL DEFAULT 90 CHECK (revenue_share_pct BETWEEN 0 AND 100),
  referral_cut_pct INT NOT NULL DEFAULT 10 CHECK (referral_cut_pct BETWEEN 0 AND 100),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_no INT NOT NULL DEFAULT 100,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS instructors_read ON public.instructors;
CREATE POLICY instructors_read ON public.instructors FOR SELECT
  USING ((is_active AND deleted_at IS NULL) OR public.fn_is_admin());
DO $$ BEGIN
  CREATE POLICY instructors_admin ON public.instructors FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 課程掛講師＋定價（price_twd=0 是免費課，走原本 audience 規則）────
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS instructor_id BIGINT REFERENCES public.instructors(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS price_twd INT NOT NULL DEFAULT 0;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS original_price_twd INT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS early_price_twd INT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS early_until TIMESTAMPTZ;

-- ── 會員首次歸因：這個客人是哪位講師帶來的（終身記在檔上）────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by BIGINT REFERENCES public.instructors(id) ON DELETE SET NULL;

-- ── 講師的線下服務（展示價；線下成交，站內只管預約與歸因）────────────
CREATE TABLE IF NOT EXISTS public.services (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instructor_id BIGINT NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_min INT NOT NULL DEFAULT 60 CHECK (duration_min > 0),
  price_twd INT NOT NULL DEFAULT 0 CHECK (price_twd >= 0),
  location_note TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_no INT NOT NULL DEFAULT 100,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS services_read ON public.services;
CREATE POLICY services_read ON public.services FOR SELECT
  USING ((is_active AND deleted_at IS NULL) OR public.fn_is_admin());
DO $$ BEGIN
  CREATE POLICY services_admin ON public.services FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 可預約時段（平台代講師登；capacity 通常 1＝一對一）────────────────
CREATE TABLE IF NOT EXISTS public.booking_slots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id BIGINT NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_booking_slots_service ON public.booking_slots (service_id, starts_at);
ALTER TABLE public.booking_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS slots_read ON public.booking_slots;
CREATE POLICY slots_read ON public.booking_slots FOR SELECT
  USING (deleted_at IS NULL OR public.fn_is_admin());
DO $$ BEGIN
  CREATE POLICY slots_admin ON public.booking_slots FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 預約（看完課→約線下服務的橋；source_course_id 記轉換來源）──────────
--   狀態流：pending（學員送出）→ confirmed（確認）→ completed／cancelled／no_show
--   容量檢查等前台預約流程上線時用 fn_book_slot RPC 做；後台代訂由管理員自行看時段
CREATE TABLE IF NOT EXISTS public.bookings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slot_id BIGINT NOT NULL REFERENCES public.booking_slots(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  note TEXT NOT NULL DEFAULT '',
  source_course_id BIGINT REFERENCES public.courses(id) ON DELETE SET NULL,
  referrer_instructor_id BIGINT REFERENCES public.instructors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON public.bookings (slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON public.bookings (user_id);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY bookings_own_read ON public.bookings FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bookings_own_insert ON public.bookings FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND status = 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bookings_admin ON public.bookings FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 訂單（課程購買）───────────────────────────────────────────────
--   三方拆帳金額「下單當下算好存死」：日後改分潤比例不影響舊帳。
--   本階段收款靠人工（轉帳對帳後管理員標記已付）；綠界核可後 Edge Function 走 ecpay。
--   status='paid' 就是課程門票——fn_can_access_course 直接查這張表。
CREATE TABLE IF NOT EXISTS public.orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  course_id BIGINT NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  amount_twd INT NOT NULL CHECK (amount_twd >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'manual' CHECK (payment_method IN ('manual','ecpay')),
  ecpay_trade_no TEXT,
  -- 講師也存快照：課程日後換講師，舊訂單的分潤對象不變
  instructor_id BIGINT REFERENCES public.instructors(id) ON DELETE SET NULL,
  referral_code TEXT,
  referrer_instructor_id BIGINT REFERENCES public.instructors(id) ON DELETE SET NULL,
  instructor_amount_twd INT NOT NULL DEFAULT 0,
  referrer_amount_twd INT NOT NULL DEFAULT 0,
  platform_amount_twd INT NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_user_course ON public.orders (user_id, course_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON public.orders (paid_at);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY orders_own_read ON public.orders FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY orders_admin ON public.orders FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 全站預設分潤比例（單列設定表；講師個別談約蓋過這裡）────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_revenue_share_pct INT NOT NULL DEFAULT 90 CHECK (default_revenue_share_pct BETWEEN 0 AND 100),
  default_referral_cut_pct INT NOT NULL DEFAULT 10 CHECK (default_referral_cut_pct BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY settings_admin ON public.platform_settings FOR ALL TO authenticated
    USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 守門函式改版：付費課看「有沒有買」────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_has_purchased(p_course BIGINT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = auth.uid() AND o.course_id = p_course AND o.status = 'paid'
  )
$$;

-- 蓋掉檔案前段那一版（orders 表要先存在才能定義這版，所以放這裡）。
-- 規則：付費課（price_twd>0）＝買了才看得到內容；免費課照舊走 audience 分級。
-- 退款把 status 改掉，權限自動收回，不用另外動作。
CREATE OR REPLACE FUNCTION public.fn_can_access_course(p_course BIGINT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.fn_is_admin() THEN true
    WHEN NOT c.is_active OR c.deleted_at IS NOT NULL THEN false
    WHEN c.price_twd > 0 THEN public.fn_has_purchased(p_course)
    WHEN c.audience = 'public' THEN true
    WHEN c.audience = 'member' THEN public.fn_my_tier() IN ('member','agent')
    WHEN c.audience = 'agent'  THEN public.fn_my_tier() = 'agent'
    ELSE false END
  FROM public.courses c WHERE c.id = p_course
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 跑完之後，老闆把自己升成管理員（email 換成你註冊用的信箱）：
--   UPDATE public.profiles SET tier = 'admin' WHERE email = 'you@example.com';
-- ═══════════════════════════════════════════════════════════════════
