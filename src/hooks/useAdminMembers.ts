import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, Tier } from '../lib/types'

/** 後台「會員」分頁的資料層：撈全部會員＋搜尋＋一鍵改身分。 */
export function useAdminMembers() {
  const [rows, setRows] = useState<Profile[]>([])
  const [loaded, setLoaded] = useState(false)
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setRows((data as Profile[] | null) ?? [])
    setLoaded(true)
  }, [])

  useEffect(() => { void load() }, [load])

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase()
    if (!k) return rows
    return rows.filter(r => r.name.toLowerCase().includes(k) || r.email.toLowerCase().includes(k))
  }, [rows, q])

  const setTier = useCallback(async (p: Profile, tier: Tier) => {
    setBusyId(p.user_id)
    const { error } = await supabase.from('profiles').update({ tier }).eq('user_id', p.user_id)
    if (!error) setRows(rs => rs.map(r => r.user_id === p.user_id ? { ...r, tier } : r))
    setBusyId(null)
  }, [])

  const setName = useCallback(async (userId: string, name: string) => {
    setBusyId(userId)
    const { error } = await supabase.from('profiles').update({ name }).eq('user_id', userId)
    setBusyId(null)
    if (error) return error.message
    setRows(rs => rs.map(r => r.user_id === userId ? { ...r, name } : r))
    return null
  }, [])

  return { rows, loaded, q, setQ, shown, busyId, setTier, setName }
}
