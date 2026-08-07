import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Chapter, Course, Material, Reward } from '../lib/types'

/** 目錄層資料：課程＋章節＋教材登記表＋獎勵，一次撈齊（量小，整棵樹好算進度）。
 *  教材列受 RLS 保護——沒權限的課撈回來就是空的，卡片支數顯示 0 沒關係，
 *  因為上鎖卡本來就不顯示進度。 */
export function useCatalog() {
  const [courses, setCourses] = useState<Course[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const [c, ch, m, r] = await Promise.all([
        supabase.from('courses').select('*').order('sort_no').order('id'),
        supabase.from('course_chapters').select('*').order('sort_no').order('key'),
        supabase.from('course_videos').select('*').order('sort_no').order('id'),
        supabase.from('course_rewards').select('*').order('id'),
      ])
      setCourses((c.data as Course[] | null) ?? [])
      setChapters((ch.data as Chapter[] | null) ?? [])
      setMaterials((m.data as Material[] | null) ?? [])
      setRewards((r.data as Reward[] | null) ?? [])
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const chaptersOf = useCallback(
    (courseId: number) =>
      chapters
        .filter(c => c.course_id === courseId && c.is_active)
        .sort((a, b) => a.sort_no - b.sort_no || a.key.localeCompare(b.key))
        .map((c, i) => ({ ...c, no: i + 1 })),
    [chapters])

  return { courses, chapters, materials, rewards, loaded, reload: load, chaptersOf }
}
