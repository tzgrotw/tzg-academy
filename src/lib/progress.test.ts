import { describe, expect, it } from 'vitest'
import { countProgress, DONE_PCT, isDone, nextToWatch, playable } from './progress'
import type { Material, Progress } from './types'

function material(overrides: Partial<Material> & { id: number; chapter_key: string }): Material {
  return {
    label: `video-${overrides.id}`,
    kind: 'video',
    storage_path: 'some/path.mp4',
    youtube_id: null,
    duration_sec: 300,
    sort_no: overrides.id,
    is_active: true,
    deleted_at: null,
    ...overrides,
  }
}

function progress(videoId: number, pct: number): Progress {
  return { user_id: 'u1', video_id: videoId, pct, last_sec: 0, completed_at: null }
}

describe('isDone', () => {
  it('treats null/undefined progress as not done', () => {
    expect(isDone(null)).toBe(false)
    expect(isDone(undefined)).toBe(false)
  })

  it('is not done just below the threshold', () => {
    expect(isDone(progress(1, DONE_PCT - 1))).toBe(false)
  })

  it('is done at or above the threshold', () => {
    expect(isDone(progress(1, DONE_PCT))).toBe(true)
    expect(isDone(progress(1, 100))).toBe(true)
  })
})

describe('playable', () => {
  it('only counts active videos with a storage path or a YouTube id', () => {
    const rows = [
      material({ id: 1, chapter_key: 'c1', kind: 'video', is_active: true, storage_path: 'x.mp4' }),
      material({ id: 2, chapter_key: 'c1', kind: 'doc', is_active: true, storage_path: 'x.pdf' }),
      material({ id: 3, chapter_key: 'c1', kind: 'video', is_active: false, storage_path: 'x.mp4' }),
      material({ id: 4, chapter_key: 'c1', kind: 'video', is_active: true, storage_path: null }),
      material({ id: 5, chapter_key: 'c1', kind: 'video', is_active: true, storage_path: null, youtube_id: 'abc123' }),
    ]
    expect(playable(rows).map(r => r.id)).toEqual([1, 5])
  })
})

describe('countProgress', () => {
  it('counts only playable videos that are done, out of all playable videos', () => {
    const rows = [
      material({ id: 1, chapter_key: 'c1' }),
      material({ id: 2, chapter_key: 'c1' }),
      material({ id: 3, chapter_key: 'c1', kind: 'doc' }),
    ]
    const progOf = (id: number) => (id === 1 ? progress(1, 100) : null)
    expect(countProgress(rows, progOf)).toEqual({ done: 1, total: 2 })
  })
})

describe('nextToWatch', () => {
  const rows = [
    material({ id: 1, chapter_key: 'c1', sort_no: 1 }),
    material({ id: 2, chapter_key: 'c1', sort_no: 2 }),
    material({ id: 3, chapter_key: 'c2', sort_no: 1 }),
  ]
  const order = ['c1', 'c2']

  it('returns the first not-done video in chapter/sort_no order', () => {
    const progOf = () => null
    expect(nextToWatch(rows, progOf, order)?.id).toBe(1)
  })

  it('skips completed videos and resumes at the first unfinished one', () => {
    const progOf = (id: number) => (id === 1 ? progress(1, 100) : null)
    expect(nextToWatch(rows, progOf, order)?.id).toBe(2)
  })

  it('crosses into the next chapter once the current one is finished', () => {
    const progOf = (id: number) => (id === 1 || id === 2 ? progress(id, 100) : null)
    expect(nextToWatch(rows, progOf, order)?.id).toBe(3)
  })

  it('returns null once every video is done', () => {
    const progOf = () => progress(0, 100)
    expect(nextToWatch(rows, progOf, order)).toBeNull()
  })

  it('ignores videos whose chapter is not in the ordered chapter list (e.g. an inactive chapter)', () => {
    const withHiddenChapter = [...rows, material({ id: 4, chapter_key: 'hidden', sort_no: 1 })]
    const progOf = () => null
    expect(nextToWatch(withHiddenChapter, progOf, order)?.id).toBe(1)
  })
})
