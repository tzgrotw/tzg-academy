import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Booking, BookingStatus } from '../lib/types'

/** 後台「預約」資料層——列表＋狀態流轉（確認/完成/取消/未到）。
 *  時段與服務資料由 useAdminInstructors 提供，頁面自行組合。 */
export function useAdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false })
      if (error) { setError(error.message); return }
      setBookings((data as Booking[] | null) ?? [])
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const setStatus = useCallback(async (id: number, status: BookingStatus) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id)
    if (error) return error.message
    setBookings(list => list.map(b => b.id === id ? { ...b, status } : b))
    return null
  }, [])

  /** 後台代客建預約（客人打電話來約的情況） */
  const createBooking = useCallback(async (input: {
    slotId: number
    userId: string
    note?: string
    sourceCourseId?: number | null
  }) => {
    const { data, error } = await supabase.from('bookings').insert({
      slot_id: input.slotId, user_id: input.userId, status: 'confirmed',
      note: input.note?.trim() ?? '', source_course_id: input.sourceCourseId ?? null,
    }).select().single()
    if (error) return error.message
    setBookings(list => [data as Booking, ...list])
    return null
  }, [])

  return { bookings, loaded, error, reload: load, setStatus, createBooking }
}
