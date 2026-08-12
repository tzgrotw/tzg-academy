-- 新增 8 門女性主題課程；不更新、不刪除任何既有課程。
-- 可安全重跑：以 wc- 開頭的章節 key 判斷該課是否已建立。
DO $$
DECLARE
  v_course BIGINT;
BEGIN
  -- 1 女性微型創業
  IF NOT EXISTS (SELECT 1 FROM public.course_chapters WHERE key = 'wc-start-01') THEN
    INSERT INTO public.courses (title, tagline, audience, cover_url, sort_no)
    VALUES ('她的微型創業起步課', '用 30 天把專長變成第一個有人願意買的方案', 'public', '/course-covers/women-startup.jpg', 110)
    RETURNING id INTO v_course;
    INSERT INTO public.course_chapters (key, course_id, title, tagline, sort_no) VALUES
      ('wc-start-01',v_course,'01｜找到值得開始的創業題目','從能力、熱情與市場交集選題',10),
      ('wc-start-02',v_course,'02｜描繪第一位理想顧客','不服務所有人，先幫一種人',20),
      ('wc-start-03',v_course,'03｜做出最小可行方案','用最小成本驗證真需求',30),
      ('wc-start-04',v_course,'04｜完成 30 天行動計畫','把想法排進真實生活',40);
    INSERT INTO public.course_sections (chapter_key,heading,items,note,sort_no) VALUES
      ('wc-start-01','三圈選題法',ARRAY['我做得好的事：列出別人經常請你幫忙的 5 件事','我願意持續的事：留下做完仍有能量的項目','市場願意付費的事：找出能節省時間、降低焦慮或帶來成果的問題'],'今天的成果：寫出「我幫助誰，解決什麼問題」一句話。',10),
      ('wc-start-02','顧客不是人口資料，而是一個情境',ARRAY['描述她正在經歷的具體時刻','寫出她試過卻沒用的替代方法','用她會說的語言記下 3 個痛點','訪談 3 人，只問經驗，不急著推銷'],'完成一張理想顧客情境卡。',10),
      ('wc-start-03','先賣成果，再堆功能',ARRAY['把承諾縮成 7 至 14 天可感受的改變','只保留交付成果必需的內容','邀請 5 位潛在顧客看提案','用回覆、預約或訂金驗證，不用按讚數驗證'],'完成一頁式最小方案。',10),
      ('wc-start-04','每週只推進一個關鍵結果',ARRAY['第 1 週訪談與定題','第 2 週完成方案與價格','第 3 週邀請與首次銷售','第 4 週交付、蒐集回饋並迭代'],'行動要小到今天就能開始。',10);
    INSERT INTO public.course_rewards(course_id,after_chapter,title,message) VALUES
      (v_course,'wc-start-02','需求洞察者','你已能從真實情境看見顧客需求。'),
      (v_course,'wc-start-04','微型創業啟程','你已完成第一份可執行的 30 天創業藍圖。');
  END IF;

  -- 2 個人品牌
  IF NOT EXISTS (SELECT 1 FROM public.course_chapters WHERE key = 'wc-brand-01') THEN
    INSERT INTO public.courses (title,tagline,audience,cover_url,sort_no) VALUES
      ('女性個人品牌：真實而有影響力','找到定位、說好故事，建立不必討好所有人的品牌', 'member','/course-covers/women-brand.jpg',120) RETURNING id INTO v_course;
    INSERT INTO public.course_chapters(key,course_id,title,tagline,sort_no) VALUES
      ('wc-brand-01',v_course,'01｜定義你的品牌核心','讓人一聽就知道你相信什麼',10),('wc-brand-02',v_course,'02｜說出有記憶點的故事','用轉折與選擇建立信任',20),
      ('wc-brand-03',v_course,'03｜建立內容三支柱','穩定產出，不再每天想題目',30),('wc-brand-04',v_course,'04｜設計 14 天發布計畫','從被看見走向被信任',40);
    INSERT INTO public.course_sections(chapter_key,heading,items,note,sort_no) VALUES
      ('wc-brand-01','一句話品牌定位',ARRAY['我服務的核心對象是誰','她想從什麼狀態走到什麼狀態','我選擇用什麼獨特方法陪她','我不做什麼，也是品牌的一部分'],'格式：我幫助＿＿，透過＿＿，達成＿＿。',10),
      ('wc-brand-02','故事的四個節點',ARRAY['原本的我：讓人產生共感','關鍵困境：說出真實張力','一次選擇：展現價值觀','現在的邀請：把舞台留給讀者'],'真誠不等於揭露一切；只分享已整理好的經驗。',10),
      ('wc-brand-03','三種內容缺一不可',ARRAY['專業內容：證明你能解題','觀點內容：表達你如何看世界','連結內容：讓人感覺你是活生生的人','同一主題可拆成教學、故事、清單與問答'],'每一篇只服務一個讀者問題。',10),
      ('wc-brand-04','14 天低壓節奏',ARRAY['每週 2 篇深度內容','每週 2 次簡短互動','每週 1 次清楚邀請','記錄收藏、回覆與詢問，而非只看觸及'],'持續比爆紅更能建立可複利的信任。',10);
    INSERT INTO public.course_rewards(course_id,after_chapter,title,message) VALUES (v_course,'wc-brand-02','故事點燈人','你已把經歷整理成能照亮他人的故事。'),(v_course,'wc-brand-04','真實影響力','你的品牌開始有清楚而一致的聲音。');
  END IF;

  -- 3 溫柔財務
  IF NOT EXISTS (SELECT 1 FROM public.course_chapters WHERE key = 'wc-money-01') THEN
    INSERT INTO public.courses(title,tagline,audience,cover_url,sort_no) VALUES ('不焦慮的創業財務課','看懂成本、定價與現金流，讓喜歡的事可以長久','member','/course-covers/women-money.jpg',130) RETURNING id INTO v_course;
    INSERT INTO public.course_chapters(key,course_id,title,tagline,sort_no) VALUES ('wc-money-01',v_course,'01｜分清營收、利潤與現金','建立老闆真正需要的數字感',10),('wc-money-02',v_course,'02｜算出不委屈自己的價格','成本、價值與市場三方平衡',20),('wc-money-03',v_course,'03｜建立每月現金流儀表板','提早看見缺口與選擇',30),('wc-money-04',v_course,'04｜設計安全感帳戶','為稅金、薪資與成長留位置',40);
    INSERT INTO public.course_sections(chapter_key,heading,items,note,sort_no) VALUES
      ('wc-money-01','三個數字各自回答不同問題',ARRAY['營收：總共賣了多少','利潤：扣除成本後是否值得做','現金流：此刻帳上是否付得出錢','每週固定 20 分鐘更新一次'],'本課為一般商業教育，不取代會計、稅務或投資專業建議。',10),
      ('wc-money-02','價格底線公式',ARRAY['直接成本＋工時成本＋營運分攤＝最低成本','再加入合理利潤與風險緩衝','用方案分級呈現價值，不用任意打折','價格不被接受時，先調整對象或方案'],'定價不是對自我價值打分數。',10),
      ('wc-money-03','一頁式月表',ARRAY['月初現金餘額','確定會進來與出去的金額','保守、基準、樂觀三種情境','每週比較預估與實際差異'],'能提早四週看見問題，就多四週做選擇。',10),
      ('wc-money-04','四個用途分帳',ARRAY['營運帳：支付日常成本','稅務帳：收到錢就提撥','老闆薪資帳：建立穩定報酬','成長與預備帳：因應淡季和投資'],'先從每筆收入提撥 1% 開始也有效。',10);
    INSERT INTO public.course_rewards(course_id,after_chapter,title,message) VALUES (v_course,'wc-money-02','價值定價者','你已能用數字守住合理價格。'),(v_course,'wc-money-04','財務安心感','你建立了讓事業更穩定的金錢系統。');
  END IF;

  -- 4 時間與能量
  IF NOT EXISTS (SELECT 1 FROM public.course_chapters WHERE key = 'wc-time-01') THEN
    INSERT INTO public.courses(title,tagline,audience,cover_url,sort_no) VALUES ('她的時間與能量管理','不靠燃燒自己，也能把重要的事穩穩完成','public','/course-covers/women-time.jpg',140) RETURNING id INTO v_course;
    INSERT INTO public.course_chapters(key,course_id,title,tagline,sort_no) VALUES ('wc-time-01',v_course,'01｜看見時間流向','用一週盤點找回主導權',10),('wc-time-02',v_course,'02｜依能量安排工作','把對的任務放在對的時段',20),('wc-time-03',v_course,'03｜建立專注與界線','減少切換、通知與隱形責任',30),('wc-time-04',v_course,'04｜設計可持續的一週','工作、成長與休息都留位置',40);
    INSERT INTO public.course_sections(chapter_key,heading,items,note,sort_no) VALUES
      ('wc-time-01','做一份不批判的時間紀錄',ARRAY['連續 3 天每 30 分鐘簡記活動','標記必要、重要與可移除','圈出最常被打斷的時段','只挑一個漏點改善'],'盤點的目的不是自責，而是取得真實資料。',10),
      ('wc-time-02','任務也有能量需求',ARRAY['高能量：創作、決策、困難對話','中能量：會議、整理、例行產出','低能量：歸檔、回覆與準備','保留最清醒的 60 分鐘給最重要的事'],'先排能量，再塞行程。',10),
      ('wc-time-03','界線要說得具體',ARRAY['設定訊息回覆時段','用可交付日期代替立刻答應','一次只開一個工作畫面','建立「這週不做」清單'],'清楚的界線是可靠，不是自私。',10),
      ('wc-time-04','理想週模板',ARRAY['先放睡眠、用餐與恢復','再放固定承諾','安排 3 個本週關鍵結果','留下至少 20% 緩衝'],'一個能重複的普通週，勝過偶爾完美的一天。',10);
    INSERT INTO public.course_rewards(course_id,after_chapter,title,message) VALUES (v_course,'wc-time-02','能量觀察家','你開始按自己的節奏安排重要任務。'),(v_course,'wc-time-04','從容行動者','你設計了不燃燒自己的可持續週。');
  END IF;

  -- 5 花藝
  IF NOT EXISTS (SELECT 1 FROM public.course_chapters WHERE key = 'wc-flower-01') THEN
    INSERT INTO public.courses(title,tagline,audience,cover_url,sort_no) VALUES ('日常花藝與美感練習','從選花、配色到構圖，為生活留一座小花園','public','/course-covers/women-flower.jpg',150) RETURNING id INTO v_course;
    INSERT INTO public.course_chapters(key,course_id,title,tagline,sort_no) VALUES ('wc-flower-01',v_course,'01｜認識花材與工具','安全處理，延長觀賞期',10),('wc-flower-02',v_course,'02｜學會自然配色','用主色、鄰近色與留白創造和諧',20),('wc-flower-03',v_course,'03｜完成第一盆桌花','用高低、方向與群組建立節奏',30),('wc-flower-04',v_course,'04｜用手機拍出作品感','光線、背景與視角的簡單選擇',40);
    INSERT INTO public.course_sections(chapter_key,heading,items,note,sort_no) VALUES
      ('wc-flower-01','開始前的四件事',ARRAY['準備花剪、乾淨容器與清水','移除水線以下的葉片','枝腳斜剪並立即入水','每天換水並清洗容器'],'剪刀遠離兒童；不熟悉的植物避免接觸寵物與食物。',10),
      ('wc-flower-02','60／30／10 配色',ARRAY['60% 主色建立整體印象','30% 輔色增加層次','10% 點綴色帶來驚喜','綠葉與容器也算色彩'],'拿不準時，先用同色深淺最容易成功。',10),
      ('wc-flower-03','自然構圖四步驟',ARRAY['先用枝葉定出輪廓','放入 3 至 5 朵主花','以小花連接空隙','旋轉作品檢查每一面'],'留白能讓每朵花呼吸。',10),
      ('wc-flower-04','窗邊就是最好的攝影棚',ARRAY['關掉室內黃燈，使用側面自然光','選一個乾淨背景','拍正面、45 度與細節三種視角','輕微調整亮度，不過度濾鏡'],'作品照也是觀察美感的一種練習。',10);
    INSERT INTO public.course_rewards(course_id,after_chapter,title,message) VALUES (v_course,'wc-flower-03','日常花藝師','你已完成一盆有節奏與留白的桌花。'),(v_course,'wc-flower-04','美感收藏家','你學會用影像保存自己的創作。');
  END IF;

  -- 6 香氛蠟燭
  IF NOT EXISTS (SELECT 1 FROM public.course_chapters WHERE key = 'wc-candle-01') THEN
    INSERT INTO public.courses(title,tagline,audience,cover_url,sort_no) VALUES ('手作香氛蠟燭入門','安全完成第一顆專屬香氣，享受專注創作的午後','member','/course-covers/women-candle.jpg',160) RETURNING id INTO v_course;
    INSERT INTO public.course_chapters(key,course_id,title,tagline,sort_no) VALUES ('wc-candle-01',v_course,'01｜材料、工具與安全','先懂燃燒，才能放心創作',10),('wc-candle-02',v_course,'02｜建立香氣筆記','理解前中後調與香氣強度',20),('wc-candle-03',v_course,'03｜完成容器蠟燭','秤量、融蠟、調香與注蠟',30),('wc-candle-04',v_course,'04｜養蠟與燃燒測試','記錄並改善下一次配方',40);
    INSERT INTO public.course_sections(chapter_key,heading,items,note,sort_no) VALUES
      ('wc-candle-01','安全是配方的一部分',ARRAY['使用耐熱容器、專用溫度計與電子秤','工作區保持通風、平穩並遠離兒童寵物','不讓融蠟離開視線，不直接在爐火上加熱','香精與蠟材遵守供應商建議比例'],'備妥隔熱手套與滅火毯；蠟起火不可潑水。',10),
      ('wc-candle-02','三層香氣練習',ARRAY['前調：最先感受、揮發較快','中調：香氣主題與個性','後調：停留較久、支撐整體','先用試香紙記錄 15 分鐘與 2 小時後感受'],'精油不等於一定安全，仍須遵守蠟燭用途的安全用量。',10),
      ('wc-candle-03','小批次製作流程',ARRAY['消毒並固定燭芯','精準秤量蠟與香材','依材料規格控制加香與注蠟溫度','緩慢注入並避免移動至完全凝固'],'材料規格不同，溫度與比例以供應商文件為準。',10),
      ('wc-candle-04','一次只改一個變因',ARRAY['養蠟至材料建議時間','首次燃燒記錄熔池、火焰與香氣','每次燃燒前修剪燭芯','若過熱、冒黑煙或容器異常，立即停止使用'],'燃燒時全程有人看顧，每次不超過製造商建議時間。',10);
    INSERT INTO public.course_rewards(course_id,after_chapter,title,message) VALUES (v_course,'wc-candle-02','香氣調香師','你已建立第一份有層次的香氣筆記。'),(v_course,'wc-candle-04','手作點燈人','你完成並學會安全測試自己的蠟燭。');
  END IF;

  -- 7 書寫成長
  IF NOT EXISTS (SELECT 1 FROM public.course_chapters WHERE key = 'wc-journal-01') THEN
    INSERT INTO public.courses(title,tagline,audience,cover_url,sort_no) VALUES ('21 天自我成長書寫','每天 10 分鐘，聽見自己、整理選擇、溫柔前進','public','/course-covers/women-journal.jpg',170) RETURNING id INTO v_course;
    INSERT INTO public.course_chapters(key,course_id,title,tagline,sort_no) VALUES ('wc-journal-01',v_course,'01｜建立安全的書寫空間','不求文筆，只求誠實出現',10),('wc-journal-02',v_course,'02｜辨認價值與渴望','從應該的人生回到自己的選擇',20),('wc-journal-03',v_course,'03｜重寫內在對話','看見批判，也練習支持自己',30),('wc-journal-04',v_course,'04｜把洞察變成微行動','設計下一個可完成的小步驟',40);
    INSERT INTO public.course_sections(chapter_key,heading,items,note,sort_no) VALUES
      ('wc-journal-01','10 分鐘自由書寫',ARRAY['選固定時間與不被打擾的位置','計時 10 分鐘，筆不停下','不修改、不評分、不必給別人看','最後圈出一句最有感覺的話'],'若書寫引發強烈或持續不適，先停止並尋求合格心理專業支持。',10),
      ('wc-journal-02','七日價值觀提問',ARRAY['哪個時刻讓我感到最像自己','我羨慕的人提醒了我什麼渴望','如果不怕被評價，我會怎麼選','我願意為哪件事付出時間'],'價值不是口號，而是願意反覆實踐的選擇。',10),
      ('wc-journal-03','把批判改寫成教練語言',ARRAY['原句：記下腦中苛刻的聲音','事實：分開可觀察事實與推測','同理：如果是好友，我會怎麼說','下一步：提出一個具體而溫柔的建議'],'支持自己不是放棄標準，而是換一種前進方式。',10),
      ('wc-journal-04','微行動設計',ARRAY['小到 15 分鐘內能開始','寫清楚何時、何地、做什麼','預先決定遇到阻力的備案','完成後記錄感受，不只記錄結果'],'21 天後，挑一個最有效的提問繼續留下。',10);
    INSERT INTO public.course_rewards(course_id,after_chapter,title,message) VALUES (v_course,'wc-journal-02','內在傾聽者','你正在辨認真正重要的價值與渴望。'),(v_course,'wc-journal-04','溫柔實踐家','你已把自我理解變成可持續的行動。');
  END IF;

  -- 8 女性社群
  IF NOT EXISTS (SELECT 1 FROM public.course_chapters WHERE key = 'wc-circle-01') THEN
    INSERT INTO public.courses(title,tagline,audience,cover_url,sort_no) VALUES ('女性共學社群帶領力','創造安全、有深度、能讓每個人發光的共學空間','agent','/course-covers/women-community.jpg',180) RETURNING id INTO v_course;
    INSERT INTO public.course_chapters(key,course_id,title,tagline,sort_no) VALUES ('wc-circle-01',v_course,'01｜建立安全與信任','用共同約定守住參與品質',10),('wc-circle-02',v_course,'02｜設計有成果的聚會','從目的倒推流程與提問',20),('wc-circle-03',v_course,'03｜練習傾聽與引導','讓安靜與不同意見都有位置',30),('wc-circle-04',v_course,'04｜讓社群可以長久','角色輪替、回饋與健康界線',40);
    INSERT INTO public.course_sections(chapter_key,heading,items,note,sort_no) VALUES
      ('wc-circle-01','共同約定範本',ARRAY['分享屬於自己，不替別人下結論','故事留在這裡，學習可以帶走','可以選擇不回答，也尊重時間界線','不同意時先好奇，再表達'],'帶領者須說明保密的限制與必要安全通報情境。',10),
      ('wc-circle-02','90 分鐘聚會骨架',ARRAY['10 分鐘抵達與報到','15 分鐘共同主題輸入','40 分鐘小組對話或實作','15 分鐘分享洞察','10 分鐘承諾與收尾'],'每場只設定一個清楚成果。',10),
      ('wc-circle-03','引導者的三個動作',ARRAY['反映：我聽見你說的是＿＿','澄清：你希望我們傾聽、提問或給建議','邀請：還沒有說話的人是否願意加入','整合：指出差異，也找出共同線索'],'沉默不是失敗，給思考留下空間。',10),
      ('wc-circle-04','健康社群的循環',ARRAY['角色輪替，避免所有責任集中一人','每次聚會收集一個保留與一個調整','清楚公布頻率、費用、取消與退出方式','定期休息並回顧社群是否仍服務初衷'],'長久不是永不結束，而是每一階段都有完整收尾。',10);
    INSERT INTO public.course_rewards(course_id,after_chapter,title,message) VALUES (v_course,'wc-circle-02','共學設計師','你已能設計一場有目的與成果的聚會。'),(v_course,'wc-circle-04','溫暖帶領者','你準備好守護一個安全而可持續的女性社群。');
  END IF;
END $$;
