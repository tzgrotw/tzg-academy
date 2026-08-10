-- ═══════════════════════════════════════════════════════════════════
-- 一次性資料——把「輕創業珠寶訓練營」5 章、16 支已經上傳到 YouTube 的
-- 影片建進資料庫。跑之前先確定 schema.sql 已經跑過最新版（course_videos
-- 要有 youtube_id 這欄，沒有的話回頭跑一次 schema.sql 就會補上）。
--
-- audience 先設成 'member'（跟 README 說的珠寶課定位一致）——不對的話
-- 之後在 /admin 課程分頁的下拉選單改就好，不用重跑這份。
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_course_id BIGINT;
BEGIN
  INSERT INTO public.courses (title, tagline, audience, sort_no)
  VALUES ('輕創業珠寶訓練營', '從市場趨勢到接單、銷售——珠寶輕創業全套實戰課', 'member', 20)
  RETURNING id INTO v_course_id;

  INSERT INTO public.course_chapters (key, course_id, title, sort_no) VALUES
    ('jewelry-ch1', v_course_id, '1.未來5年珠寶商業模式&市場熱門寶石種類', 10),
    ('jewelry-ch2', v_course_id, '2.彩色寶石基礎知識', 20),
    ('jewelry-ch3', v_course_id, '3.接單珠寶訂製課程', 30),
    ('jewelry-ch4', v_course_id, '4.店主0成本銷售方式', 40),
    ('jewelry-ch5', v_course_id, '5.怎麼用新媒體銷售珠寶', 50);

  INSERT INTO public.course_videos (chapter_key, label, kind, youtube_id, sort_no) VALUES
    ('jewelry-ch1', '第 1 段', 'video', 'woN3n1npJFs', 10),
    ('jewelry-ch1', '第 2 段', 'video', 's52GaMn9bMU', 20),
    ('jewelry-ch1', '第 3 段', 'video', 'DenbEXYB14A', 30),
    ('jewelry-ch2', '第 1 段', 'video', 'BZRiepvNetQ', 10),
    ('jewelry-ch2', '第 2 段', 'video', 'Df5LHsA_GsA', 20),
    ('jewelry-ch2', '第 3 段', 'video', '_ILioTzbvIA', 30),
    ('jewelry-ch2', '第 4 段', 'video', 'fjh9-drV6oM', 40),
    ('jewelry-ch2', '第 5 段', 'video', 'mIxH4Aq6ZNg', 50),
    ('jewelry-ch3', '第 1 段', 'video', 'ht-omyQuvrE', 10),
    ('jewelry-ch3', '第 2 段', 'video', 'Hc1dPWH_Zbw', 20),
    ('jewelry-ch3', '第 3 段', 'video', 'sS1AQs1MA0Y', 30),
    ('jewelry-ch4', '第 1 段', 'video', '0TwojM9MQX4', 10),
    ('jewelry-ch4', '第 2 段', 'video', '3j1MnTrz70g', 20),
    ('jewelry-ch4', '第 3 段', 'video', 'Ymrf9f8mLf0', 30),
    ('jewelry-ch4', '第 4 段', 'video', '7jQAp9Eo_zI', 40),
    ('jewelry-ch5', '一首歌的時間告訴你珠寶輕創業', 'video', 'wGigUFDfpxQ', 10);
END $$;

-- 講義（PDF）目前先不建──那 4 份還在 Google Drive，之後要上傳到
-- Supabase Storage 的 course-videos 桶才能在後台掛進對應章節
-- （用 /admin 課程分頁的「＋上傳講義」手動補，比另外寫腳本快）。

-- 彩色寶石入門這門課先不建──腳本爬 Drive 時這個資料夾讀不到內容
-- （回報過的已知問題），等確認 Drive 權限之後再處理。
