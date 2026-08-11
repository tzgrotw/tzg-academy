import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Assessment, Chapter, Course, Material, Reward } from '../lib/types'

/** 目錄層資料：課程＋章節＋教材登記表＋測驗作業登記表＋獎勵，一次撈齊（量小，整棵樹好算進度）。
 *  教材／測驗列受 RLS 保護——沒權限的課撈回來就是空的，卡片支數顯示 0 沒關係，
 *  因為上鎖卡本來就不顯示進度。 */
export function useCatalog() {
  const [courses, setCourses] = useState<Course[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      // .is('deleted_at', null)：軟刪除的（在垃圾桶裡）不進這裡——這是唯一撈這幾張表的地方，
      // 學員／後台編輯畫面共用，垃圾桶另外用 useAdminTrash 撈。
      const [c, ch, m, a, r] = await Promise.all([
        supabase.from('courses').select('*').is('deleted_at', null).order('sort_no').order('id'),
        supabase.from('course_chapters').select('*').is('deleted_at', null).order('sort_no').order('key'),
        supabase.from('course_videos').select('*').is('deleted_at', null).order('sort_no').order('id'),
        supabase.from('course_assessments').select('*').is('deleted_at', null).order('sort_no').order('id'),
        supabase.from('course_rewards').select('*').order('id'),
      ])
      const failed = [c, ch, m, a, r].find(result => result.error)?.error
      if (failed) {
        setError(`課程資料載入失敗：${failed.message}`)
        return
      }
      setCourses((c.data as Course[] | null) ?? [])
      setChapters((ch.data as Chapter[] | null) ?? [])
      setMaterials((m.data as Material[] | null) ?? [])
      setAssessments((a.data as Assessment[] | null) ?? [])
      setRewards((r.data as Reward[] | null) ?? [])
    } catch {
      setError('課程資料載入失敗，請檢查網路後再試一次。')
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

  /** 課程卡／首頁共用的「幾章・幾支影片」——只算上架章節裡的上架影片 */
  const courseStats = useCallback((courseId: number) => {
    const chs = chaptersOf(courseId)
    const keys = new Set(chs.map(c => c.key))
    const videoCount = materials.filter(m => keys.has(m.chapter_key) && m.kind === 'video' && m.is_active).length
    return { chapterCount: chs.length, videoCount }
  }, [chaptersOf, materials])

  // 後台單筆存檔用：改本地那一列就好，不必整包重撈四張表
  const patchCourse = useCallback((id: number, patch: Partial<Course>) =>
    setCourses(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c)), [])
  const patchChapter = useCallback((key: string, patch: Partial<Chapter>) =>
    setChapters(chs => chs.map(c => c.key === key ? { ...c, ...patch } : c)), [])
  const patchMaterial = useCallback((id: number, patch: Partial<Material>) =>
    setMaterials(ms => ms.map(m => m.id === id ? { ...m, ...patch } : m)), [])
  const patchAssessment = useCallback((id: number, patch: Partial<Assessment>) =>
    setAssessments(as => as.map(a => a.id === id ? { ...a, ...patch } : a)), [])
  const patchReward = useCallback((id: number, patch: Partial<Reward>) =>
    setRewards(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r)), [])
  const addCourseLocal = useCallback((c: Course) => setCourses(cs => [...cs, c]), [])
  const addChapterLocal = useCallback((c: Chapter) => setChapters(chs => [...chs, c]), [])
  const addMaterialLocal = useCallback((m: Material) => setMaterials(ms => [...ms, m]), [])
  const addAssessmentLocal = useCallback((a: Assessment) => setAssessments(as => [...as, a]), [])
  const addRewardLocal = useCallback((r: Reward) => setRewards(rs => [...rs, r]), [])
  const removeRewardLocal = useCallback((id: number) =>
    setRewards(rs => rs.filter(r => r.id !== id)), [])

  // 刪除有 FK cascade（章節掛在課程下、教材／測驗掛在章節下）——本地也照著砍，
  // 不用整包重撈；材料／測驗本身沒有下層，直接濾掉那一筆就好。
  const removeMaterialLocal = useCallback((id: number) =>
    setMaterials(ms => ms.filter(m => m.id !== id)), [])
  const removeAssessmentLocal = useCallback((id: number) =>
    setAssessments(as => as.filter(a => a.id !== id)), [])
  const removeChapterLocal = useCallback((key: string) => {
    setChapters(chs => chs.filter(c => c.key !== key))
    setMaterials(ms => ms.filter(m => m.chapter_key !== key))
    setAssessments(as => as.filter(a => a.chapter_key !== key))
  }, [])
  const removeCourseLocal = useCallback((id: number) => {
    const droppedKeys = new Set(chapters.filter(c => c.course_id === id).map(c => c.key))
    setChapters(chs => chs.filter(c => c.course_id !== id))
    setMaterials(ms => ms.filter(m => !droppedKeys.has(m.chapter_key)))
    setAssessments(as => as.filter(a => !droppedKeys.has(a.chapter_key)))
    setCourses(cs => cs.filter(c => c.id !== id))
  }, [chapters])

  return {
    courses, chapters, materials, assessments, rewards, loaded, error, reload: load, chaptersOf, courseStats,
    patchCourse, patchChapter, patchMaterial, patchAssessment, patchReward,
    addCourseLocal, addChapterLocal, addMaterialLocal, addAssessmentLocal, addRewardLocal,
    removeCourseLocal, removeChapterLocal, removeMaterialLocal, removeAssessmentLocal, removeRewardLocal,
  }
}
