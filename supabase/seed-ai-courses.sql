-- 新增 5 門 AI 主題課程(知識衛星風格:結果導向、模組化、每章有可交付成果);
-- 不更新、不刪除任何既有課程。可安全重跑:以 ai- 開頭的章節 key 判斷該課是否已建立。
DO $$
DECLARE
  v_course BIGINT;
BEGIN
  -- 1 AI 生產力:ChatGPT 提示詞與個人工作流
  IF NOT EXISTS (SELECT 1 FROM public.course_chapters WHERE key = 'ai-prompt-01') THEN
    INSERT INTO public.courses (title, tagline, audience, cover_url, sort_no)
    VALUES ('AI 生產力革命:ChatGPT 提示詞實戰', '把 AI 變成最懂你的工作夥伴,每天省下 2 小時', 'public', '/course-covers/ai-prompt.jpg', 190)
    RETURNING id INTO v_course;
    INSERT INTO public.course_chapters (key, course_id, title, tagline, sort_no) VALUES
      ('ai-prompt-01',v_course,'01|建立正確的 AI 心智模型','懂它怎麼想,才知道怎麼問',10),
      ('ai-prompt-02',v_course,'02|提示詞四層結構','角色、脈絡、任務、格式一次到位',20),
      ('ai-prompt-03',v_course,'03|打造個人提示詞庫','高頻工作場景範本化,一鍵重複使用',30),
      ('ai-prompt-04',v_course,'04|設計你的 AI 日常工作流','從單次問答升級成穩定流程',40);
    INSERT INTO public.course_sections (chapter_key,heading,items,note,sort_no) VALUES
      ('ai-prompt-01','AI 不是搜尋引擎,是實習生',ARRAY['它有廣泛知識但不了解你的處境——脈絡要自己給','它會自信地說錯話——重要事實必須查證','它擅長初稿、改寫、整理與腦力激盪','把它當「聰明但第一天上班的助理」來帶'],'今天的成果:列出你工作中最耗時的 5 件事,標出哪些可以交給 AI。',10),
      ('ai-prompt-02','四層提示詞公式',ARRAY['角色:你是一位資深______','脈絡:我的情況是______、目標對象是______','任務:請幫我______,要包含______','格式:用表格/條列/字數限制輸出'],'同一個問題,套上四層結構前後各問一次,比較差異。',10),
      ('ai-prompt-03','範本化的三個層級',ARRAY['常用句:開頭常打的那幾句存起來','場景範本:週報、企劃、回覆客訴各一份','變數化:把會換的部分標成【填空】','存放在隨手可貼的地方(備忘錄/筆記軟體)'],'完成你的前 5 個提示詞範本。',10),
      ('ai-prompt-04','把 AI 排進行程,不是想到才用',ARRAY['晨間 10 分鐘:讓 AI 幫你排今日優先序','會前 5 分鐘:丟資料請它列重點與提問','寫作流程:AI 出初稿→你改觀點→AI 潤稿','週五回顧:讓它從你的紀錄找出下週改善點'],'挑一個流程連續執行 5 天,記錄省下的時間。',10);
    INSERT INTO public.course_rewards(course_id,after_chapter,title,message) VALUES
      (v_course,'ai-prompt-02','提示詞設計師','你已能寫出結構完整、輸出穩定的提示詞。'),
      (v_course,'ai-prompt-04','AI 生產力實踐家','AI 已成為你每天工作流程的一部分。');
  END IF;

  -- 2 AI 繪圖設計
  IF NOT EXISTS (SELECT 1 FROM public.course_chapters WHERE key = 'ai-design-01') THEN
    INSERT INTO public.courses (title,tagline,audience,cover_url,sort_no) VALUES
      ('AI 繪圖接案實戰:從美感到商用', 'Midjourney 與生成式設計,做出客戶願意付費的視覺', 'member','/course-covers/ai-design.jpg',200) RETURNING id INTO v_course;
    INSERT INTO public.course_chapters(key,course_id,title,tagline,sort_no) VALUES
      ('ai-design-01',v_course,'01|生圖工具與美感語言','把腦中畫面翻譯成 AI 聽得懂的話',10),('ai-design-02',v_course,'02|風格一致性的秘密','參數、參考圖與風格代碼',20),
      ('ai-design-03',v_course,'03|商用場景實作','社群貼文、品牌視覺、電商圖三大案型',30),('ai-design-04',v_course,'04|授權、報價與交付','商用權利講清楚,案子才走得遠',40);
    INSERT INTO public.course_sections(chapter_key,heading,items,note,sort_no) VALUES
      ('ai-design-01','畫面描述的四個維度',ARRAY['主體:誰/什麼,在做什麼','環境:場景、時間、天氣、氛圍','鏡頭:遠近、角度、景深','光線與風格:攝影/插畫/3D、色調'],'練習:同一主體,換三種光線與風格各生一張。',10),
      ('ai-design-02','讓 50 張圖看起來是同一個品牌',ARRAY['固定風格描述句,存成範本','用參考圖固定角色與色調','記錄每張成功圖的完整參數','建立自己的風格字典(色彩/材質/構圖)'],'成果:為一個虛擬品牌做出 6 張風格一致的圖。',10),
      ('ai-design-03','三種案型的規格差異',ARRAY['社群圖:比例多變、標題留白位','品牌視覺:主視覺+延展性,交付源檔與規範','電商圖:商品清晰、情境合理、細節放大','每案先做 3 個方向草稿再收斂'],'完成一份三案型的作品集頁。',10),
      ('ai-design-04','接案前必談的四件事',ARRAY['各平台商用授權條款不同,先查清楚再承諾','報價按「方向數×修改次數×交付規格」','交付檔案命名與尺寸清單,一次給齊','留存生成紀錄,遇到爭議有依據'],'AI 生成內容的著作權在各地法規仍在演變,商用前先確認平台條款與客戶需求。',10);
    INSERT INTO public.course_rewards(course_id,after_chapter,title,message) VALUES (v_course,'ai-design-02','風格塑造者','你能穩定產出風格一致的系列視覺。'),(v_course,'ai-design-04','AI 設計接案人','你已具備從創作到商用交付的完整能力。');
  END IF;

  -- 3 AI 短影音創作
  IF NOT EXISTS (SELECT 1 FROM public.course_chapters WHERE key = 'ai-video-01') THEN
    INSERT INTO public.courses(title,tagline,audience,cover_url,sort_no) VALUES ('AI 短影音煉金術','腳本、字幕、配音到剪輯,一個人就是一個團隊','public','/course-covers/ai-video.jpg',210) RETURNING id INTO v_course;
    INSERT INTO public.course_chapters(key,course_id,title,tagline,sort_no) VALUES ('ai-video-01',v_course,'01|會被看完的腳本公式','鉤子、節奏與行動呼籲',10),('ai-video-02',v_course,'02|AI 腳本量產系統','一個主題長出 30 支影片',20),('ai-video-03',v_course,'03|拍攝與 AI 後製','手機拍+AI 字幕配音剪輯',30),('ai-video-04',v_course,'04|數據迭代與帳號經營','看懂留存曲線,越發越準',40);
    INSERT INTO public.course_sections(chapter_key,heading,items,note,sort_no) VALUES
      ('ai-video-01','前 3 秒決定生死',ARRAY['鉤子:痛點提問/反常識/結果先行','中段:一支影片只講一件事','節奏:每 5-7 秒一個畫面或資訊變化','結尾:明確告訴觀眾下一步做什麼'],'拆解 3 支你看完沒滑走的影片,找出它們的鉤子。',10),
      ('ai-video-02','主題×角度矩陣',ARRAY['1 個專業主題拆 6 個受眾痛點','每個痛點×5 種形式(教學/故事/清單/QA/迷思)','讓 AI 依矩陣批量產腳本初稿','人工把「你的經驗與觀點」填回去'],'AI 給結構,你給靈魂——沒有觀點的量產只是噪音。',10),
      ('ai-video-03','一支手機的極簡流程',ARRAY['自然光+乾淨背景+領夾麥','一次錄 3-5 支,批次處理','AI 工具自動上字幕、去語助詞、剪停頓','需要時用 AI 配音做旁白版本'],'完成第一支從腳本到成片的完整作品。',10),
      ('ai-video-04','只看三個數字',ARRAY['3 秒留存:鉤子強不強','完播率:節奏與長度對不對','互動率:內容有沒有打中人','每週選出最好一支,分析後複製它的結構'],'連續發 14 天,用數據決定下個月方向。',10);
    INSERT INTO public.course_rewards(course_id,after_chapter,title,message) VALUES (v_course,'ai-video-02','內容量產家','你已建立可持續的腳本生產系統。'),(v_course,'ai-video-04','短影音創作者','你能用數據驅動,一人完成影音內容循環。');
  END IF;

  -- 4 AI 自動化
  IF NOT EXISTS (SELECT 1 FROM public.course_chapters WHERE key = 'ai-auto-01') THEN
    INSERT INTO public.courses(title,tagline,audience,cover_url,sort_no) VALUES ('AI 自動化:打造你的數位員工','不寫程式,讓重複工作自己完成','member','/course-covers/ai-auto.jpg',220) RETURNING id INTO v_course;
    INSERT INTO public.course_chapters(key,course_id,title,tagline,sort_no) VALUES ('ai-auto-01',v_course,'01|找出值得自動化的事','先流程化,才能自動化',10),('ai-auto-02',v_course,'02|無程式碼工具上手','觸發、動作與條件的積木邏輯',20),('ai-auto-03',v_course,'03|接上 AI 大腦','讓流程會判斷、會寫字、會分類',30),('ai-auto-04',v_course,'04|監控與擴充','錯誤通知、成本控管與下一條流程',40);
    INSERT INTO public.course_sections(chapter_key,heading,items,note,sort_no) VALUES
      ('ai-auto-01','自動化三問',ARRAY['這件事每週重複超過 3 次嗎','步驟能寫成明確的 if-then 嗎','出錯的代價可以承受嗎','先手動做順一遍,把步驟寫成清單'],'成果:列出你的自動化候選清單,選定第一條。',10),
      ('ai-auto-02','每條自動化都是同一句話',ARRAY['當【觸發】發生時,做【動作】','觸發:收到表單/新郵件/固定時間','動作:寫入表格/發通知/建任務','條件:符合某情況才繼續'],'實作:表單回覆自動寫入試算表+發通知給自己。',10),
      ('ai-auto-03','AI 節點的三種用法',ARRAY['分類:來信自動判斷詢價/客訴/合作','生成:自動草擬回覆讓你審核後送出','萃取:從訊息抓出姓名日期需求存表','給 AI 的指令也要版本管理'],'重要訊息保留人工確認這一步——自動化是加速,不是失控。',10),
      ('ai-auto-04','讓流程活得久',ARRAY['每條流程都設錯誤通知','記錄每月執行次數與 API 花費','每季檢視:還需要嗎?能合併嗎?','穩定後才複製到下一個場景'],'成果:你的第一份自動化流程清單與監控表。',10);
    INSERT INTO public.course_rewards(course_id,after_chapter,title,message) VALUES (v_course,'ai-auto-02','流程建築師','你已能把重複工作寫成自動流程。'),(v_course,'ai-auto-04','數位員工主管','你擁有一支不會累的自動化小隊。');
  END IF;

  -- 5 AI 一人公司
  IF NOT EXISTS (SELECT 1 FROM public.course_chapters WHERE key = 'ai-solo-01') THEN
    INSERT INTO public.courses(title,tagline,audience,cover_url,sort_no) VALUES ('AI 一人公司:知識變現營運課','用 AI 放大你的專業,一個人經營一門好生意','member','/course-covers/ai-solo.jpg',230) RETURNING id INTO v_course;
    INSERT INTO public.course_chapters(key,course_id,title,tagline,sort_no) VALUES ('ai-solo-01',v_course,'01|定位你的知識產品','從專業裡找出可販售的改變',10),('ai-solo-02',v_course,'02|AI 內容行銷引擎','一份核心內容,長出全平台素材',20),('ai-solo-03',v_course,'03|銷售頁與轉換流程','讓陌生人變學員的路徑設計',30),('ai-solo-04',v_course,'04|營運儀表板與擴張','用數字經營,而不是用感覺',40);
    INSERT INTO public.course_sections(chapter_key,heading,items,note,sort_no) VALUES
      ('ai-solo-01','產品階梯設計',ARRAY['免費內容:建立信任的入口','小額產品:低門檻體驗你的方法','核心課程:完整帶出改變的主力','高價服務:一對一或深度陪伴','用 AI 訪談自己,把隱性經驗挖成大綱'],'成果:畫出你的產品階梯與各層價格帶。',10),
      ('ai-solo-02','一魚多吃內容系統',ARRAY['每月 1 個核心主題(長文或影片)','AI 拆成:貼文×5、短影音腳本×3、電子報×2','各平台語氣微調,不是原文照貼','素材庫按主題歸檔,可重複組合'],'建立你的第一個月內容日曆。',10),
      ('ai-solo-03','銷售頁的說服結構',ARRAY['痛點共鳴:說出她正在經歷的','願景:上完課後的具體改變','方法與見證:為什麼是你、憑什麼有效','行動:價格、保障與明確的下一步','用 AI 產 3 版文案,拿去問 5 位目標受眾'],'成果:完成一頁可以開賣的銷售頁草稿。',10),
      ('ai-solo-04','一人公司的五個數字',ARRAY['流量:多少人看到你','名單:多少人留下聯絡方式','轉換:多少人成為付費學員','客單與回購:平均價值與再次購買','每週 30 分鐘看數字,決定下週唯一重點'],'本課為商業教育分享,實際稅務與法務請諮詢專業人士。',10);
    INSERT INTO public.course_rewards(course_id,after_chapter,title,message) VALUES (v_course,'ai-solo-02','內容引擎建造者','你的專業開始自動長出行銷素材。'),(v_course,'ai-solo-04','一人公司經營者','你已具備用 AI 營運知識生意的完整地圖。');
  END IF;
END $$;
