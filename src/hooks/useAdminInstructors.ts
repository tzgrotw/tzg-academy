import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BookingSlot, Instructor, Service } from '../lib/types'

/** 後台「講師／服務與時段」的資料層——跟 useAdminContent 同一套路：
 *  寫入成功就 patch 本地，不整包重撈；每個函式回錯誤訊息（成功回 null）。 */
export function useAdminInstructors() {
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [i, s, sl] = await Promise.all([
        supabase.from('instructors').select('*').is('deleted_at', null).order('sort_no').order('id'),
        supabase.from('services').select('*').is('deleted_at', null).order('sort_no').order('id'),
        supabase.from('booking_slots').select('*').is('deleted_at', null).order('starts_at'),
      ])
      const err = i.error ?? s.error ?? sl.error
      if (err) { setError(err.message); return }
      setInstructors((i.data as Instructor[] | null) ?? [])
      setServices((s.data as Service[] | null) ?? [])
      setSlots((sl.data as BookingSlot[] | null) ?? [])
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── 講師 ──
  const createInstructor = useCallback(async (name: string, slug: string) => {
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!clean) return '網址代號只能用小寫英文、數字、連字號（例：amy-yoga）'
    const { data, error } = await supabase.from('instructors')
      .insert({ name: name.trim() || '未命名講師', slug: clean, referral_code: clean }).select().single()
    if (error) return error.message.includes('duplicate') ? `代號「${clean}」已經有人用了——換一個` : error.message
    setInstructors(list => [...list, data as Instructor])
    return null
  }, [])

  const updateInstructor = useCallback(async (id: number, patch: Partial<Instructor>) => {
    const { error } = await supabase.from('instructors').update(patch).eq('id', id)
    if (error) return error.message
    setInstructors(list => list.map(i => i.id === id ? { ...i, ...patch } : i))
    return null
  }, [])

  const uploadInstructorAvatar = useCallback(async (id: number, file: File) => {
    const path = `instructor-${id}/${Date.now()}.${file.name.split('.').pop() || 'jpg'}`
    const { error } = await supabase.storage.from('course-covers').upload(path, file, { upsert: true })
    if (error) return error.message
    const { data } = supabase.storage.from('course-covers').getPublicUrl(path)
    return updateInstructor(id, { avatar_url: data.publicUrl })
  }, [updateInstructor])

  const deleteInstructor = useCallback(async (id: number) => {
    const { error } = await supabase.from('instructors')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) return error.message
    setInstructors(list => list.filter(i => i.id !== id))
    return null
  }, [])

  // ── 服務 ──
  const createService = useCallback(async (instructorId: number, title: string) => {
    const { data, error } = await supabase.from('services')
      .insert({ instructor_id: instructorId, title: title.trim() || '未命名服務' }).select().single()
    if (error) return error.message
    setServices(list => [...list, data as Service])
    return null
  }, [])

  const updateService = useCallback(async (id: number, patch: Partial<Service>) => {
    const { error } = await supabase.from('services').update(patch).eq('id', id)
    if (error) return error.message
    setServices(list => list.map(s => s.id === id ? { ...s, ...patch } : s))
    return null
  }, [])

  const deleteService = useCallback(async (id: number) => {
    const now = new Date().toISOString()
    const { error } = await supabase.from('services').update({ deleted_at: now }).eq('id', id)
    if (error) return error.message
    // 服務下的未來時段一起下架，避免留下可約卻沒服務的孤兒時段
    await supabase.from('booking_slots').update({ deleted_at: now }).eq('service_id', id)
    setServices(list => list.filter(s => s.id !== id))
    setSlots(list => list.filter(s => s.service_id !== id))
    return null
  }, [])

  // ── 時段 ──
  const addSlots = useCallback(async (rows: Array<Pick<BookingSlot, 'service_id' | 'starts_at' | 'ends_at' | 'capacity'>>) => {
    if (rows.length === 0) return '沒有要新增的時段'
    const { data, error } = await supabase.from('booking_slots').insert(rows).select()
    if (error) return error.message
    setSlots(list => [...list, ...((data as BookingSlot[] | null) ?? [])].sort(
      (a, b) => a.starts_at.localeCompare(b.starts_at)))
    return null
  }, [])

  const deleteSlot = useCallback(async (id: number) => {
    const { error } = await supabase.from('booking_slots')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) return error.message
    setSlots(list => list.filter(s => s.id !== id))
    return null
  }, [])

  return {
    instructors, services, slots, loaded, error, reload: load,
    createInstructor, updateInstructor, uploadInstructorAvatar, deleteInstructor,
    createService, updateService, deleteService,
    addSlots, deleteSlot,
  }
}
