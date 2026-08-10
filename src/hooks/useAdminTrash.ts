import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Assessment, Chapter, Course, Material } from '../lib/types'

type TrashChapter = Chapter & { courseTitle: string }
type TrashMaterial = Material & { chapterTitle: string; courseTitle: string }
type TrashAssessment = Assessment & { chapterTitle: string; courseTitle: string }

/** 後台「垃圾桶」分頁——刪除都是軟刪除（deleted_at），這裡撈回來給還原／永久刪除。
 *  還原／刪除都連著子層一起處理，對應 useAdminContent 那邊刪除時的 cascade：
 *  砍一門課會連章節/教材/測驗一起進垃圾桶，救回來也連著一起救。 */
export function useAdminTrash() {
  const [courses, setCourses] = useState<Course[]>([])
  const [chapters, setChapters] = useState<TrashChapter[]>([])
  const [materials, setMaterials] = useState<TrashMaterial[]>([])
  const [assessments, setAssessments] = useState<TrashAssessment[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const [allCourses, allChapters, tCourses, tChapters, tMaterials, tAssessments] = await Promise.all([
      supabase.from('courses').select('*'),
      supabase.from('course_chapters').select('*'),
      supabase.from('courses').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('course_chapters').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('course_videos').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('course_assessments').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    ])
    const courseTitle = new Map(((allCourses.data as Course[] | null) ?? []).map(c => [c.id, c.title]))
    const allChs = (allChapters.data as Chapter[] | null) ?? []
    const chapterTitle = new Map(allChs.map(c => [c.key, c.title]))
    const chapterCourseId = new Map(allChs.map(c => [c.key, c.course_id]))
    const courseTitleOf = (chapterKey: string) => courseTitle.get(chapterCourseId.get(chapterKey) ?? -1) ?? '（課程已刪除）'

    setCourses((tCourses.data as Course[] | null) ?? [])
    setChapters((((tChapters.data as Chapter[] | null) ?? [])).map(c => ({ ...c, courseTitle: courseTitle.get(c.course_id) ?? '（課程已刪除）' })))
    setMaterials((((tMaterials.data as Material[] | null) ?? [])).map(m => ({
      ...m, chapterTitle: chapterTitle.get(m.chapter_key) ?? '（章節已刪除）', courseTitle: courseTitleOf(m.chapter_key),
    })))
    setAssessments((((tAssessments.data as Assessment[] | null) ?? [])).map(a => ({
      ...a, chapterTitle: chapterTitle.get(a.chapter_key) ?? '（章節已刪除）', courseTitle: courseTitleOf(a.chapter_key),
    })))
    setLoaded(true)
  }, [])

  useEffect(() => { void load() }, [load])

  const restoreCourse = useCallback(async (id: number) => {
    const chapterKeys = chapters.filter(c => c.course_id === id).map(c => c.key)
    const { error } = await supabase.from('courses').update({ deleted_at: null }).eq('id', id)
    if (error) return error.message
    if (chapterKeys.length > 0) {
      await supabase.from('course_chapters').update({ deleted_at: null }).in('key', chapterKeys)
      await supabase.from('course_videos').update({ deleted_at: null }).in('chapter_key', chapterKeys)
      await supabase.from('course_assessments').update({ deleted_at: null }).in('chapter_key', chapterKeys)
    }
    await load()
    return null
  }, [chapters, load])

  const restoreChapter = useCallback(async (key: string) => {
    const { error } = await supabase.from('course_chapters').update({ deleted_at: null }).eq('key', key)
    if (error) return error.message
    await supabase.from('course_videos').update({ deleted_at: null }).eq('chapter_key', key)
    await supabase.from('course_assessments').update({ deleted_at: null }).eq('chapter_key', key)
    await load()
    return null
  }, [load])

  const restoreMaterial = useCallback(async (id: number) => {
    const { error } = await supabase.from('course_videos').update({ deleted_at: null }).eq('id', id)
    if (error) return error.message
    await load()
    return null
  }, [load])

  const restoreAssessment = useCallback(async (id: number) => {
    const { error } = await supabase.from('course_assessments').update({ deleted_at: null }).eq('id', id)
    if (error) return error.message
    await load()
    return null
  }, [load])

  // 垃圾桶裡再刪一次才是真的永久刪除——走原本的 DELETE（FK cascade 照樣把子層一起清掉）
  const purgeCourse = useCallback(async (id: number) => {
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) return error.message
    await load()
    return null
  }, [load])
  const purgeChapter = useCallback(async (key: string) => {
    const { error } = await supabase.from('course_chapters').delete().eq('key', key)
    if (error) return error.message
    await load()
    return null
  }, [load])
  const purgeMaterial = useCallback(async (id: number) => {
    const { error } = await supabase.from('course_videos').delete().eq('id', id)
    if (error) return error.message
    await load()
    return null
  }, [load])
  const purgeAssessment = useCallback(async (id: number) => {
    const { error } = await supabase.from('course_assessments').delete().eq('id', id)
    if (error) return error.message
    await load()
    return null
  }, [load])

  return {
    courses, chapters, materials, assessments, loaded,
    restoreCourse, restoreChapter, restoreMaterial, restoreAssessment,
    purgeCourse, purgeChapter, purgeMaterial, purgeAssessment,
  }
}
