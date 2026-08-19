import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { splitOrder } from '../lib/tier'
import type { Instructor, Order } from '../lib/types'

/** 後台「訂單」資料層。本階段收款靠人工：管理員建單（pending）→ 對完帳按「標記已付」，
 *  paid 訂單就是課程門票（RLS 的 fn_has_purchased 直接查 orders）。
 *  三方拆帳在「建單當下」用 splitOrder 算好存死——日後改分潤比例不影響舊帳。 */
export function useAdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
      if (error) { setError(error.message); return }
      setOrders((data as Order[] | null) ?? [])
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const createOrder = useCallback(async (input: {
    userId: string
    courseId: number
    amountTwd: number
    instructor: Instructor | null
    referrer: Instructor | null
    note?: string
  }) => {
    const { userId, courseId, amountTwd, instructor, referrer, note } = input
    if (referrer && instructor && referrer.id === instructor.id) return '推薦人不能是課程講師自己'
    // 平台自營課（沒掛講師）：全額歸平台，只有推薦抽成要分出去
    const split = instructor
      ? splitOrder(amountTwd, instructor.revenue_share_pct, instructor.referral_cut_pct, !!referrer)
      : { instructor: 0, referrer: referrer ? splitOrder(amountTwd, 0, referrer.referral_cut_pct, true).referrer : 0, platform: 0 }
    if (!instructor) split.platform = amountTwd - split.referrer
    const { data, error } = await supabase.from('orders').insert({
      user_id: userId, course_id: courseId, amount_twd: amountTwd,
      instructor_id: instructor?.id ?? null,
      referral_code: referrer?.referral_code ?? null,
      referrer_instructor_id: referrer?.id ?? null,
      instructor_amount_twd: split.instructor,
      referrer_amount_twd: split.referrer,
      platform_amount_twd: split.platform,
      note: note?.trim() ?? '',
    }).select().single()
    if (error) return error.message
    setOrders(list => [data as Order, ...list])
    return null
  }, [])

  const setStatus = useCallback(async (id: number, status: Order['status']) => {
    const patch: Partial<Order> = { status }
    if (status === 'paid') patch.paid_at = new Date().toISOString()
    const { error } = await supabase.from('orders').update(patch).eq('id', id)
    if (error) return error.message
    setOrders(list => list.map(o => o.id === id ? { ...o, ...patch } : o))
    return null
  }, [])

  return { orders, loaded, error, reload: load, createOrder, setStatus }
}
