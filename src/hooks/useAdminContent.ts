import { useCallback } from 'react'
import { useCatalog } from './useCatalog'
import { supabase } from '../lib/supabase'
import type { Chapter, Course, Material } from '../lib/types'

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

  const toggleMaterial = useCallback(async (material: Material) => {
    const nextActive = !material.is_active
    const { error } = await supabase.from('course_videos').update({ is_active: nextActive }).eq('id', material.id)
    if (error) return error.message
    cat.patchMaterial(material.id, { is_active: nextActive })
    return null
  }, [cat])

  return {
    ...cat,
    createCourse, updateCourse, uploadCourseCover,
    addChapter, updateChapter, uploadChapterCover,
    uploadMaterial, toggleMaterial,
  }
}
