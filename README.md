# 泰熙爾札娜學院（TZG Academy）

女性創業與自我成長的線上課程平台——**獨立站**：自己的資料庫（Supabase）、
自己的部署（Vercel），跟 TZG-Hub 完全分開。視覺照 2026-08-05 老闆定稿的畫面提案
（Kajabi 設計語言＋CIS 品牌色）。

## 給老闆的開站三步驟

### ① 開一個全新的 Supabase 專案（5 分鐘）
1. 到 https://supabase.com/dashboard → **New project**（名稱建議 `tzg-academy`，區域選 Singapore）
2. 開好後進 **SQL Editor** → 把整份
   [`supabase/schema.sql`](https://github.com/VitoKOK-lab/TZG-Hub/blob/main/academy/supabase/schema.sql)
   貼上 → **Run**（重複跑不會壞事）
3. **Authentication → Providers → Email**：把「Confirm email」關掉（省一道確認信，想開著也行）
4. 記下兩個值（**Settings → API**）：`Project URL` 和 `anon public` key

### ② 開一個 Vercel 專案（5 分鐘）
1. https://vercel.com/new → Import `VitoKOK-lab/TZG-Hub`
2. **Root Directory 填 `academy`**（這個最重要——學院住在這個資料夾）
3. Environment Variables 加兩條（值用①拿到的）：
   - `VITE_SUPABASE_URL` ＝ Project URL
   - `VITE_SUPABASE_ANON_KEY` ＝ anon public key
4. Deploy。之後要綁自己的網址：Vercel 專案 → Settings → Domains

### ③ 把自己升成管理員（1 分鐘）
1. 到新站 `/register` 註冊一個帳號（用你自己的 Email）
2. 回 Supabase SQL Editor 跑一行（email 換成你剛註冊的）：
   ```sql
   UPDATE public.profiles SET tier = 'admin' WHERE email = 'you@example.com';
   ```
3. 重新整理新站 → 頂欄出現「後台」→ 開始建課、管會員

## 會員分級（免費公開＋會員解鎖，不接金流）

| 身分 | 誰 | 看得到什麼 |
|---|---|---|
| 訪客 | 沒登入 | 首頁、課程目錄、課程介紹頁 |
| 會員 | 免費註冊 | ＋公開課內容、影片（自動記進度）、會員課 |
| 代理 | 助理在後台升級 | ＋代理專屬課 |
| 管理員 | 後台 | 建課＋管會員 |

升級／降級都在 `/admin` 的「會員」分頁，一鍵改。

## 開發

```bash
cd academy
npm install
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run dev
```

## 結構（比照 TZG-Hub 的分層規矩）

```
supabase/schema.sql   資料庫整份底座（表＋RLS＋桶）——動表先改這裡
src/lib/              純規則：tier 分級、進度計算、型別（可測試層）
src/hooks/            資料：auth/目錄/進度
src/components/       畫面：頂欄、課程卡、影片列（記進度在這）
src/pages/            頁面：首頁/目錄/介紹/上課/註冊/後台
```

搬到獨立 repo：整個 `academy/` 資料夾拷過去就能動（沒有任何對 TZG-Hub 的 import）。
