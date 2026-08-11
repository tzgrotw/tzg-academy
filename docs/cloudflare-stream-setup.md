# Cloudflare Stream 設定手冊（收費課影片專用）

> 平台的影片策略：**免費／招生課用 YouTube（零成本），收費課用 Cloudflare Stream（簽名防護＋自動調畫質）**。
> 這份手冊從開帳號到第一支影片上線，照著做一次就好；之後日常只剩「上傳影片 → 貼 ID」兩步。

## 為什麼是 Cloudflare Stream

- 收費影片開「Require Signed URLs」之後，**沒有平台簽發的憑證誰都播不了**——學員把連結傳出去沒有用。
- 自動依網速調畫質（HLS），手機收訊差也不會一直轉圈。
- 費用按分鐘計：儲存每 1,000 分鐘約 US$5/月、被觀看每 1,000 分鐘約 US$1。
  以 10 堂課 × 20 支 × 10 分鐘（約 2,000 分鐘）估算：儲存約 US$10/月，加上觀看量通常整體落在 **US$15–25/月**。

## 一次性設定（約 30 分鐘）

### 第 1 步：開 Cloudflare 帳號＋開通 Stream

1. 到 <https://dash.cloudflare.com> 註冊（免費）。
2. 左側選單找 **Stream**，點進去照指示開通（需要掛信用卡，按用量月結）。

### 第 2 步：抄下三個代碼

之後要貼到 Supabase 的 Secrets 用：

| 代碼 | 去哪裡找 |
|---|---|
| **Account ID** | dash.cloudflare.com 任一頁的右側欄「Account ID」 |
| **API Token** | 右上角頭像 → My Profile → API Tokens → Create Token → 用「Custom token」，權限只勾 **Stream : Edit**，建立後把 token 抄下來（只會顯示一次） |
| **Customer Code** | Stream → 隨便點一支影片 → Embed 的網址長這樣：`customer-XXXXX.cloudflarestream.com`，抄 `XXXXX` 那段 |

### 第 3 步：把播放憑證函式裝進 Supabase

1. 開 <https://supabase.com/dashboard> → 你的專案 → 左側 **Edge Functions** → **Deploy a new function**（用瀏覽器內建編輯器即可）。
2. 函式名稱填：`cf-stream-token`
3. 把 repo 裡 `supabase/functions/cf-stream-token/index.ts` 的內容整份貼進去 → Deploy。
4. 同頁進 **Secrets**，加三筆（名稱要一字不差）：
   - `CF_ACCOUNT_ID` ＝ 第 2 步的 Account ID
   - `CF_API_TOKEN` ＝ 第 2 步的 API Token
   - `CF_CUSTOMER_CODE` ＝ 第 2 步的 Customer Code

### 第 4 步：資料庫加欄位

`supabase/schema.sql` 已含 `cf_stream_id` 欄位——把整份 schema.sql 貼到 **SQL Editor** 重跑一次（重複執行安全）。

## 日常流程（每支影片 2 分鐘）

1. **上傳**：Cloudflare 後台 → Stream → **Upload**，把影片檔拖進去（跟上傳 YouTube 一樣）。
2. **鎖起來**：點開該影片 → Settings → **Require Signed URLs 打開**（這步不做，等於沒鎖）。
   （偷懶法：Stream 的帳號層級設定可以把「新影片預設 Require Signed URLs」打開，之後就不用逐支設。）
3. **貼進後台**：複製影片的 **Video ID**（32 碼）→ 學院後台 → 課程 → 章節 → 「＋加 Cloudflare 影片」貼上＋填標題。

完成。學員端播放、進度記錄、續播、修畢計算全部自動——跟自家上傳影片的體驗一樣（不用像 YouTube 手動按「看完了」）。

## 出問題時

| 症狀 | 原因與解法 |
|---|---|
| 學員看到「Cloudflare 還沒設定完成」 | 第 3 步的三個 Secrets 沒設齊——回 Supabase Edge Functions → Secrets 檢查名稱有沒有打錯 |
| 「簽發播放憑證失敗」 | API Token 權限不對（要 Stream:Edit）或影片 ID 貼錯——到 Cloudflare 後台核對那 32 碼 |
| 影片誰都能播（沒鎖到） | 那支影片的 Require Signed URLs 沒開——回日常流程第 2 步 |
| 播放器一直轉圈 | 影片可能還在 Cloudflare 轉檔（剛上傳完要等幾分鐘）——到 Stream 後台看狀態是不是 Ready |
