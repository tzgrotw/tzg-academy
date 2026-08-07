import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DONE_PCT } from '../lib/progress'
import type { Progress } from '../lib/types'

/** 個人觀看進度：撈全部（量小）＋樂觀更新＋upsert。
 *  mark() 用 ref 拿最新值、依賴空陣列——寫進度不會讓播放器重新掛載
 *  （TZG-Hub 學過的課：依賴 prog 會變成每次寫入都重繪、瘋狂打 DB）。 */
export function useProgress(userId: string | null) {
  const [prog, setProg] = useState<Record<number, Progress>>({})
  const [loaded, setLoaded] = useState(false)
  const progRef = useRef(prog)
  progRef.current = prog
  const uidRef = useRef(userId)
  uidRef.current = userId

  useEffect(() => {
    let alive = true
    if (!userId) { setProg({}); setLoaded(true); return }
    supabase.from('video_progress').select('*').then(({ data }) => {
      if (!alive) return
      const map: Record<number, Progress> = {}
      for (const row of (data as Progress[] | null) ?? []) map[row.video_id] = row
      setProg(map)
      setLoaded(true)
    })
    return () => { alive = false }
  }, [userId])

  const progressOf = useCallback((videoId: number): Progress | null =>
    progRef.current[videoId] ?? null, [])

  const mark = useCallback((videoId: number, pct: number, lastSec: number) => {
    const uid = uidRef.current
    if (!uid) return
    const prev = progRef.current[videoId]
    const nextPct = Math.max(prev?.pct ?? 0, pct)   // 進度只進不退（重看不會掉勾）
    const row: Progress = {
      user_id: uid, video_id: videoId, pct: nextPct, last_sec: lastSec,
      completed_at: prev?.completed_at ?? (nextPct >= DONE_PCT ? new Date().toISOString() : null),
    }
    setProg(p => ({ ...p, [videoId]: row }))
    void supabase.from('video_progress').upsert({
      user_id: uid, video_id: videoId, pct: nextPct, last_sec: lastSec,
      completed_at: row.completed_at, updated_at: new Date().toISOString(),
    })
  }, [])

  return { prog, loaded, progressOf, mark }
}
