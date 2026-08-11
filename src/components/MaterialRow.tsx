import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isDone } from '../lib/progress'
import { IconCheck, IconFileText } from './icons'
import type { Material, Progress } from '../lib/types'

// pdf.js 是重量級的 library——不要讓每個進站的人都先載這包，
// 只有真的點開講義的人才要付這個流量／解析成本。
const PdfViewer = lazy(() => import('./PdfViewer').then(m => ({ default: m.PdfViewer })))

/** 每隔幾秒寫一次進度——太密一直打資料庫，太疏關掉分頁掉太多 */
const SAVE_EVERY_SEC = 15
/** 簽名網址活多久（秒）——看很久過期會觸發 onError 重簽 */
const SIGN_TTL = 60 * 60

async function signUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('course-videos').createSignedUrl(path, SIGN_TTL)
  if (error || !data?.signedUrl) throw new Error('影片載入失敗——網路不穩或還沒登入')
  return data.signedUrl
}

/** 影片列：點一下換簽名網址、內嵌播放、自動記進度、自動續播。
 *  手機體驗是這一站的招牌（Kajabi 被罵的點）：playsInline＝iOS 轉橫向不中斷。
 *  三種來源：Cloudflare Stream（收費課・簽名 token）→ YouTube（免費課）→ 自家 storage。 */
export function VideoRow({ video, progress, onProgress }: {
  video: Material
  progress: Progress | null
  onProgress: (videoId: number, pct: number, lastSec: number) => void
}) {
  if (video.cf_stream_id) return <CfVideoRow video={video} progress={progress} onProgress={onProgress} />
  if (video.youtube_id) return <YoutubeVideoRow video={video} progress={progress} onProgress={onProgress} />
  return <StorageVideoRow video={video} progress={progress} onProgress={onProgress} />
}

/** YouTube 內嵌播放——iframe 沒辦法像 <video> 一樣拿到 timeupdate，
 *  簡單版先不自動抓百分比，看完自己按「標記看完」（README 決定：先求穩，之後想做自動追蹤再接 YouTube IFrame API）。 */
function YoutubeVideoRow({ video, progress, onProgress }: {
  video: Material
  progress: Progress | null
  onProgress: (videoId: number, pct: number, lastSec: number) => void
}) {
  const [open, setOpen] = useState(false)
  const done = isDone(progress)

  if (open) {
    return (
      <div className="player-box">
        <p style={{ fontSize: 13, fontWeight: 700, marginTop: 14 }}>{video.label}</p>
        <div className="yt-wrap">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.youtube_id}?rel=0`}
            title={video.label} allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
        {!done && (
          <button className="btn-line" style={{ marginTop: 12 }} onClick={() => onProgress(video.id, 100, 0)}>
            看完了・標記這支
          </button>
        )}
      </div>
    )
  }

  return (
    <button className="vrow" onClick={() => setOpen(true)}>
      <span className={`ic ${done ? 'done' : 'play'}`}>{done && <IconCheck size={16} />}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <b>{video.label}</b>
        <span className="sub">{done ? '看完了——點了可以重看' : '點了開始播'}</span>
      </span>
      {done && <span className="pct i"><IconCheck size={11} />看完</span>}
    </button>
  )
}

/** 進度追蹤播放器——storage 直連檔案跟 Cloudflare HLS 共用同一套：
 *  自動續播、每 15 秒記進度、關分頁補寫、過期重簽。 */
function TrackedPlayer({ video, url, hls, done, resumeSec, onProgress, onExpire }: {
  video: Material
  url: string
  hls: boolean
  done: boolean
  resumeSec: number
  onProgress: (videoId: number, pct: number, lastSec: number) => void
  onExpire: () => void
}) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const lastSavedRef = useRef(0)

  const save = useCallback((el: HTMLVideoElement, force = false) => {
    const dur = el.duration
    if (!dur || !Number.isFinite(dur)) return
    const cur = el.currentTime
    if (!force && cur - lastSavedRef.current < SAVE_EVERY_SEC) return
    lastSavedRef.current = cur
    onProgress(video.id, Math.min(100, Math.floor((cur / dur) * 100)), Math.floor(cur))
  }, [onProgress, video.id])

  // 關分頁／切走前補寫一次——最後那段沒滿 15 秒的進度不能掉
  useEffect(() => {
    const flush = () => { const el = ref.current; if (el && !el.paused) save(el, true) }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      flush()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [save])

  // HLS 串流：Safari 原生就會播 m3u8；其他瀏覽器動態載 hls.js（跟 pdf.js 一樣，用到才載）
  useEffect(() => {
    const el = ref.current
    if (!el || !hls) return
    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = url
      return
    }
    let destroyed = false
    let instance: import('hls.js').default | null = null
    void import('hls.js').then(({ default: Hls }) => {
      if (destroyed || !ref.current) return
      if (!Hls.isSupported()) { onExpire(); return }
      instance = new Hls()
      instance.loadSource(url)
      instance.attachMedia(ref.current)
      instance.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) onExpire() })
    })
    return () => { destroyed = true; instance?.destroy() }
  }, [hls, url, onExpire])

  return (
    <div className="player-box">
      <p style={{ fontSize: 13, fontWeight: 700, marginTop: 14 }}>{video.label}</p>
      <video
        ref={ref} src={hls ? undefined : url} controls playsInline preload="metadata" autoPlay
        onLoadedMetadata={e => {
          const el = e.currentTarget
          if (resumeSec > 3 && !done && resumeSec < el.duration - 5) {
            el.currentTime = resumeSec
            lastSavedRef.current = resumeSec
          }
        }}
        onTimeUpdate={e => save(e.currentTarget)}
        onPause={e => save(e.currentTarget, true)}
        onEnded={e => {
          lastSavedRef.current = e.currentTarget.duration
          onProgress(video.id, 100, Math.floor(e.currentTarget.duration))
        }}
        onError={() => { if (!hls) onExpire() }}
      />
    </div>
  )
}

/** 收合列（沒點開時）——三種影片來源共用 */
function VideoListRow({ video, progress, busy, onOpen }: {
  video: Material
  progress: Progress | null
  busy: boolean
  onOpen: () => void
}) {
  const done = isDone(progress)
  const pct = progress?.pct ?? 0
  const mins = video.duration_sec ? `${Math.floor(video.duration_sec / 60)}:${String(video.duration_sec % 60).padStart(2, '0')}` : null
  return (
    <button className="vrow" onClick={onOpen} disabled={busy}>
      <span className={`ic ${done ? 'done' : 'play'}`}>{done && <IconCheck size={16} />}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <b>{video.label}</b>
        <span className="sub">
          {busy ? '載入中…' : done ? '看完了——點了可以重看' : pct > 0 ? `看到 ${pct}%・點了從上次的地方繼續` : (mins ?? '點了開始播')}
        </span>
      </span>
      <span className={`pct${done ? ' i' : ''}`}>{done ? <><IconCheck size={11} />看完</> : pct > 0 ? `${pct}%` : (mins ?? '')}</span>
    </button>
  )
}

function StorageVideoRow({ video, progress, onProgress }: {
  video: Material
  progress: Progress | null
  onProgress: (videoId: number, pct: number, lastSec: number) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const open = useCallback(async () => {
    if (!video.storage_path) return
    setBusy(true); setErr(null)
    try { setUrl(await signUrl(video.storage_path)) }
    catch (e) { setErr(e instanceof Error ? e.message : '影片載入失敗') }
    finally { setBusy(false) }
  }, [video.storage_path])

  if (url) {
    return (
      <TrackedPlayer video={video} url={url} hls={false} done={isDone(progress)}
        resumeSec={progress?.last_sec ?? 0} onProgress={onProgress}
        onExpire={() => { setUrl(null); setErr('影片連線過期了——再點一次重新載入') }} />
    )
  }
  return (
    <>
      <VideoListRow video={video} progress={progress} busy={busy} onOpen={() => void open()} />
      {err && <p className="formerr">{err}</p>}
    </>
  )
}

/** Cloudflare Stream（收費課）——跟 Edge Function 換一張簽名播放憑證再播 HLS。
 *  憑證兩小時過期，過期就回列表請學員再點一次（會換新的一張）。 */
function CfVideoRow({ video, progress, onProgress }: {
  video: Material
  progress: Progress | null
  onProgress: (videoId: number, pct: number, lastSec: number) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const open = useCallback(async () => {
    setBusy(true); setErr(null)
    try {
      const { data, error } = await supabase.functions.invoke('cf-stream-token', {
        body: { video_id: video.id },
      })
      if (error || !data?.url) throw new Error('影片載入失敗——網路不穩，或還沒登入。重新整理後再點一次')
      setUrl(data.url as string)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '影片載入失敗——再點一次重試')
    } finally {
      setBusy(false)
    }
  }, [video.id])

  if (url) {
    return (
      <TrackedPlayer video={video} url={url} hls done={isDone(progress)}
        resumeSec={progress?.last_sec ?? 0} onProgress={onProgress}
        onExpire={() => { setUrl(null); setErr('影片連線過期了——再點一次重新載入') }} />
    )
  }
  return (
    <>
      <VideoListRow video={video} progress={progress} busy={busy} onOpen={() => void open()} />
      {err && <p className="formerr">{err}</p>}
    </>
  )
}

/** 講義：自己刻的 PDF 閱讀器內嵌播放，不丟去瀏覽器內建那個陽春檢視器。不記進度。 */
export function DocRow({ doc }: { doc: Material }) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const open = async () => {
    if (!doc.storage_path) return
    setBusy(true); setErr(null)
    try { setUrl(await signUrl(doc.storage_path)) }
    catch (e) { setErr(e instanceof Error ? e.message : '講義載入失敗') }
    finally { setBusy(false) }
  }

  if (url) {
    return (
      <Suspense fallback={<div className="skel" style={{ marginTop: 16 }} />}>
        <PdfViewer url={url} label={doc.label} onClose={() => setUrl(null)} />
      </Suspense>
    )
  }

  return (
    <>
      <button className="vrow" onClick={() => void open()} disabled={busy}>
        <span className="ic"><IconFileText size={16} /></span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <b>{doc.label}</b>
          <span className="sub">{busy ? '載入中…' : '講義・點了在這裡看'}</span>
        </span>
      </button>
      {err && <p className="formerr">{err}</p>}
    </>
  )
}
