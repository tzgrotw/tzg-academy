import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isDone } from '../lib/progress'
import { IconCheck, IconFileText } from './icons'
import type { Material, Progress } from '../lib/types'

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
 *  手機體驗是這一站的招牌（Kajabi 被罵的點）：playsInline＝iOS 轉橫向不中斷。 */
export function VideoRow({ video, progress, onProgress }: {
  video: Material
  progress: Progress | null
  onProgress: (videoId: number, pct: number, lastSec: number) => void
}) {
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

function StorageVideoRow({ video, progress, onProgress }: {
  video: Material
  progress: Progress | null
  onProgress: (videoId: number, pct: number, lastSec: number) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ref = useRef<HTMLVideoElement | null>(null)
  const lastSavedRef = useRef(0)

  const done = isDone(progress)
  const pct = progress?.pct ?? 0
  const resumeSec = progress?.last_sec ?? 0

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

  const open = useCallback(async () => {
    if (!video.storage_path) return
    setBusy(true); setErr(null)
    try { setUrl(await signUrl(video.storage_path)) }
    catch (e) { setErr(e instanceof Error ? e.message : '影片載入失敗') }
    finally { setBusy(false) }
  }, [video.storage_path])

  const mins = video.duration_sec ? `${Math.floor(video.duration_sec / 60)}:${String(video.duration_sec % 60).padStart(2, '0')}` : null

  if (url) {
    return (
      <div className="player-box">
        <p style={{ fontSize: 13, fontWeight: 700, marginTop: 14 }}>{video.label}</p>
        <video
          ref={ref} src={url} controls playsInline preload="metadata" autoPlay
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
          onError={() => { setUrl(null); setErr('影片連線過期了——再點一次重新載入') }}
        />
      </div>
    )
  }

  return (
    <>
      <button className="vrow" onClick={() => void open()} disabled={busy}>
        <span className={`ic ${done ? 'done' : 'play'}`}>{done && <IconCheck size={16} />}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <b>{video.label}</b>
          <span className="sub">
            {done ? '看完了——點了可以重看' : pct > 0 ? `看到 ${pct}%・點了從上次的地方繼續` : (mins ?? '點了開始播')}
          </span>
        </span>
        <span className={`pct${done ? ' i' : ''}`}>{done ? <><IconCheck size={11} />看完</> : pct > 0 ? `${pct}%` : (mins ?? '')}</span>
      </button>
      {err && <p className="formerr">{err}</p>}
    </>
  )
}

/** 講義：開新分頁用瀏覽器自己的閱讀器（手機上比任何內嵌都好用），不記進度 */
export function DocRow({ doc }: { doc: Material }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  const open = async () => {
    if (!doc.storage_path) return
    setBusy(true); setErr(false)
    const tab = window.open('', '_blank')   // 先開分頁再換網址：await 完才 open 會被手機擋成彈窗
    try {
      const u = await signUrl(doc.storage_path)
      if (tab) tab.location.href = u; else window.location.href = u
    } catch { tab?.close(); setErr(true) }
    finally { setBusy(false) }
  }
  return (
    <button className="vrow" onClick={() => void open()} disabled={busy}>
      <span className="ic"><IconFileText size={16} /></span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <b>{doc.label}</b>
        <span className="sub">{err ? '開不起來，再按一次' : '講義・點了開新分頁看'}</span>
      </span>
    </button>
  )
}
