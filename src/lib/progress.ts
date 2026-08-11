import type { Material, Progress } from './types'

/** 看到 95% 才算看完——拖到最後幾秒的片尾不用硬看 */
export const DONE_PCT = 95

export const isDone = (p: Progress | null | undefined) => (p?.pct ?? 0) >= DONE_PCT

/** 只有影片列入進度分母（講義/圖片不記進度：「看到幾成」對它們不成立）——
 *  影片來源可能是自家 storage、YouTube 或 Cloudflare Stream，三種都要算，
 *  不然單一來源的章節進度永遠是 0/0。 */
export const playable = (rows: Material[]) =>
  rows.filter(r => r.kind === 'video' && r.is_active && (r.storage_path || r.youtube_id || r.cf_stream_id))

export function countProgress(rows: Material[], progOf: (id: number) => Progress | null) {
  const vids = playable(rows)
  const done = vids.filter(v => isDone(progOf(v.id))).length
  return { done, total: vids.length }
}

/** 續看哪一支：第一支「還沒看完」的，照章節順序＋sort_no */
export function nextToWatch(
  rows: Material[],
  progOf: (id: number) => Progress | null,
  orderedChapterKeys: string[],
): Material | null {
  const order = new Map(orderedChapterKeys.map((k, i) => [k, i]))
  const vids = playable(rows)
    .filter(v => order.has(v.chapter_key))
    .sort((a, b) =>
      (order.get(a.chapter_key)! - order.get(b.chapter_key)!) || (a.sort_no - b.sort_no) || (a.id - b.id))
  return vids.find(v => !isDone(progOf(v.id))) ?? null
}
