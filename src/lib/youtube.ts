// 後台貼「YouTube 影片 ID 或網址」都吃——管理員複製瀏覽器網址列比自己去挖 ID 方便。
const ID_RE = /^[\w-]{11}$/

export function extractYoutubeId(input: string): string | null {
  const s = input.trim()
  if (ID_RE.test(s)) return s
  try {
    const u = new URL(s)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (u.hostname.endsWith('youtube.com') || u.hostname.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v')
      if (v && ID_RE.test(v)) return v
      const m = u.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/)
      if (m) return m[1]
    }
  } catch { /* 不是網址，就當作不合法 ID 處理 */ }
  return null
}
