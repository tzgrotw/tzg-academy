import { useCallback } from 'react'
import { useCatalog } from './useCatalog'
import { supabase } from '../lib/supabase'
import { extractYoutubeId } from '../lib/youtube'
import type { Assessment, AssessmentKind, Chapter, Course, Material } from '../lib/types'

const newChapterKey = () => `ch${Date.now().toString(36)}`

/** 後台「課程」分頁的資料層：課→章→教材的所有寫入動作都在這裡，
 *  存成功就直接改本地那一列（patch/addLocal），不整包重撈 useCatalog 的四張表。
 *  每個函式回傳錯誤訊息（成功回 null），component 只管顯示。 */
export function useAdminContent() {
  const cat = useCatalog()

  const createCourse = useCallback(async () => {
    const { data, error } = await supabase.from('courses')
      .insert({ title: '未命名課程', audience: 'public' }).select().single()
    if (error) return error.message
    cat.addCourseLocal(data as Course)
    return null
  }, [cat])

  const updateCourse = useCallback(async (id: number, patch: Partial<Course>) => {
    const { error } = await supabase.from('courses')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return error.message
    cat.patchCourse(id, patch)
    return null
  }, [cat])

  const uploadCourseCover = useCallback(async (courseId: number, file: File) => {
    const path = `course-${courseId}/${Date.now()}.${file.name.split('.').pop() || 'jpg'}`
    const { error } = await supabase.storage.from('course-covers').upload(path, file, { upsert: true })
    if (error) return error.message
    const { data } = supabase.storage.from('course-covers').getPublicUrl(path)
    return updateCourse(courseId, { cover_url: data.publicUrl })
  }, [updateCourse])

  const addChapter = useCallback(async (courseId: number, afterSortNo: number) => {
    const { data, error } = await supabase.from('course_chapters').insert({
      key: newChapterKey(), course_id: courseId, title: '新章節', sort_no: afterSortNo + 10,
    }).select().single()
    if (error) return error.message
    cat.addChapterLocal(data as Chapter)
    return null
  }, [cat])

  const updateChapter = useCallback(async (key: string, patch: Partial<Chapter>) => {
    const { error } = await supabase.from('course_chapters').update(patch).eq('key', key)
    if (error) return error.message
    cat.patchChapter(key, patch)
    return null
  }, [cat])

  const uploadChapterCover = useCallback(async (chapterKey: string, file: File) => {
    const path = `ch-${chapterKey}/${Date.now()}.${file.name.split('.').pop() || 'jpg'}`
    const { error } = await supabase.storage.from('course-covers').upload(path, file, { upsert: true })
    if (error) return error.message
    const { data } = supabase.storage.from('course-covers').getPublicUrl(path)
    return updateChapter(chapterKey, { cover_url: data.publicUrl })
  }, [updateChapter])

  const uploadMaterial = useCallback(async (
    chapterKey: string, file: File, kind: 'video' | 'doc', afterSortNo: number,
  ) => {
    const path = `${chapterKey}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from('course-videos').upload(path, file)
    if (error) return error.message
    const { data, error: e2 } = await supabase.from('course_videos').insert({
      chapter_key: chapterKey, label: file.name.replace(/\.\w+$/, ''), kind, storage_path: path,
      sort_no: afterSortNo + 10,
    }).select().single()
    if (e2) return e2.message
    cat.addMaterialLocal(data as Material)
    return null
  }, [cat])

  const addYoutubeMaterial = useCallback(async (
    chapterKey: string, urlOrId: string, label: string, afterSortNo: number,
  ) => {
    const youtubeId = extractYoutubeId(urlOrId)
    if (!youtubeId) return '看不出來是哪支 YouTube 影片——貼完整網址或 11 碼的影片 ID'
    const { data, error } = await supabase.from('course_videos').insert({
      chapter_key: chapterKey, label: label.trim() || '未命名影片', kind: 'video',
      youtube_id: youtubeId, sort_no: afterSortNo + 10,
    }).select().single()
    if (error) return error.message
    cat.addMaterialLocal(data as Material)
    return null
  }, [cat])

  const updateMaterial = useCallback(async (id: number, patch: Partial<Material>) => {
    const { error } = await supabase.from('course_videos').update(patch).eq('id', id)
    if (error) return error.message
    cat.patchMaterial(id, patch)
    return null
  }, [cat])

  const toggleMaterial = useCallback((material: Material) =>
    updateMaterial(material.id, { is_active: !material.is_active }), [updateMaterial])

  const addAssessment = useCallback(async (chapterKey: string, kind: AssessmentKind, afterSortNo: number) => {
    const { data, error } = await supabase.from('course_assessments').insert({
      chapter_key: chapterKey, kind, title: kind === 'quiz' ? '新測驗' : '新作業',
      sort_no: afterSortNo + 10,
    }).select().single()
    if (error) return error.message
    cat.addAssessmentLocal(data as Assessment)
    return null
  }, [cat])

  const updateAssessment = useCallback(async (id: number, patch: Partial<Assessment>) => {
    const { error } = await supabase.from('course_assessments').update(patch).eq('id', id)
    if (error) return error.message
    cat.patchAssessment(id, patch)
    return null
  }, [cat])

  const deleteAssessment = useCallback(async (id: number) => {
    const { error } = await supabase.from('course_assessments').delete().eq('id', id)
    if (error) return error.message
    cat.removeAssessmentLocal(id)
    return null
  }, [cat])

  // 三層都有 FK cascade（課→章→教材／測驗），DB 那邊砍一筆會連下層一起清掉；
  // 本地也對應地清（removeCourseLocal/removeChapterLocal 會一起濾掉子層）。
  const deleteCourse = useCallback(async (id: number) => {
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) return error.message
    cat.removeCourseLocal(id)
    return null
  }, [cat])

  const deleteChapter = useCallback(async (key: string) => {
    const { error } = await supabase.from('course_chapters').delete().eq('key', key)
    if (error) return error.message
    cat.removeChapterLocal(key)
    return null
  }, [cat])

  const deleteMaterial = useCallback(async (id: number) => {
    const { error } = await supabase.from('course_videos').delete().eq('id', id)
    if (error) return error.message
    cat.removeMaterialLocal(id)
    return null
  }, [cat])

  return {
    ...cat,
    createCourse, updateCourse, uploadCourseCover, deleteCourse,
    addChapter, updateChapter, uploadChapterCover, deleteChapter,
    uploadMaterial, addYoutubeMaterial, updateMaterial, toggleMaterial, deleteMaterial,
    addAssessment, updateAssessment, deleteAssessment,
  }
}
