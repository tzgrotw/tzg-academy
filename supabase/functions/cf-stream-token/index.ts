// Cloudflare Stream 播放憑證簽發（Supabase Edge Function，Deno 環境）
//
// 為什麼要有這支：收費課影片放 Cloudflare Stream 並開「Require signed URLs」，
// 沒有簽名 token 誰都播不了。這支函式做三件事：
//   1. 確認來的人登入了（Authorization header 的 JWT）
//   2. 用「那個人自己的身分」查 course_videos——RLS 會擋掉沒權限的章節，
//      查得到那一列＝有權看，查不到＝沒權限，不用重寫一次權限邏輯
//   3. 跟 Cloudflare API 換一張 2 小時的播放 token，回傳 HLS 播放網址
//
// 需要的 Secrets（Supabase 後台 Edge Functions → Secrets 設定）：
//   CF_ACCOUNT_ID     Cloudflare 帳號 ID（dash.cloudflare.com 右側欄）
//   CF_API_TOKEN      API Token，權限只要 Stream:Edit（拿來簽 token 用）
//   CF_CUSTOMER_CODE  客戶代碼（Stream 影片內嵌網址 customer-XXXX 的那段 XXXX）
//
// 部署（擇一）：
//   a. Supabase 後台 → Edge Functions → New function → 名稱 cf-stream-token → 貼這份程式碼
//   b. 或本機 supabase CLI：supabase functions deploy cf-stream-token

import { createClient } from 'jsr:@supabase/supabase-js@2'

const TOKEN_TTL_SEC = 60 * 60 * 2

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const fail = (status: number, message: string) =>
    new Response(JSON.stringify({ error: message }), {
      status, headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return fail(401, '請先登入再播放')

    const { video_id } = await req.json().catch(() => ({}))
    if (typeof video_id !== 'number') return fail(400, '缺 video_id')

    // 用使用者自己的 JWT 建 client——RLS 以「他」的身分執行，權限判斷交給資料庫
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: video, error } = await supabase
      .from('course_videos')
      .select('id, cf_stream_id')
      .eq('id', video_id)
      .maybeSingle()
    if (error) return fail(500, `查影片失敗：${error.message}`)
    if (!video?.cf_stream_id) return fail(403, '沒有這支影片，或沒有觀看權限')

    const accountId = Deno.env.get('CF_ACCOUNT_ID')
    const apiToken = Deno.env.get('CF_API_TOKEN')
    const customerCode = Deno.env.get('CF_CUSTOMER_CODE')
    if (!accountId || !apiToken || !customerCode) {
      return fail(500, 'Cloudflare 還沒設定完成——後台 Secrets 缺 CF_ACCOUNT_ID / CF_API_TOKEN / CF_CUSTOMER_CODE')
    }

    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${video.cf_stream_id}/token`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC,
          downloadable: false,
        }),
      },
    )
    const cfJson = await cfRes.json().catch(() => null)
    const token = cfJson?.result?.token
    if (!cfRes.ok || !token) {
      return fail(502, 'Cloudflare 簽發播放憑證失敗——檢查影片 ID 是否正確、API Token 權限是否為 Stream:Edit')
    }

    return new Response(JSON.stringify({
      url: `https://customer-${customerCode}.cloudflarestream.com/${token}/manifest/video.m3u8`,
      expires_in: TOKEN_TTL_SEC,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return fail(500, e instanceof Error ? e.message : '未知錯誤')
  }
})
