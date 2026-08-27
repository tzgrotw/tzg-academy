import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

interface PurchasesState {
  /** 我買過的課（paid 訂單的 course_id 集合）——付費課前端開鎖判斷都靠這份 */
  purchased: Set<number>
  purchasesLoaded: boolean
  refreshPurchases: () => Promise<void>
}

const EMPTY = new Set<number>()
const Ctx = createContext<PurchasesState>({
  purchased: EMPTY, purchasesLoaded: false, refreshPurchases: async () => {},
})

/** 全站只撈一次「我的已付訂單」（RLS 只回自己的單），掛在 AuthProvider 裡層。
 *  未登入就是空集合——免費課不受影響。 */
export function PurchasesProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const [purchased, setPurchased] = useState<Set<number>>(EMPTY)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!userId) { setPurchased(EMPTY); setLoaded(true); return }
    const { data } = await supabase.from('orders').select('course_id').eq('status', 'paid')
    setPurchased(new Set(((data ?? []) as { course_id: number }[]).map(o => o.course_id)))
    setLoaded(true)
  }, [userId])

  useEffect(() => { setLoaded(false); void load() }, [load])

  return (
    <Ctx.Provider value={{ purchased, purchasesLoaded: loaded, refreshPurchases: load }}>
      {children}
    </Ctx.Provider>
  )
}

export const usePurchases = () => useContext(Ctx)
