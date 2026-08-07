import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthState {
  loading: boolean
  userId: string | null
  profile: Profile | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState>({
  loading: true, userId: null, profile: null,
  refreshProfile: async () => {}, signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  async function loadProfile(uid: string | null) {
    if (!uid) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('user_id', uid)
    setProfile((data?.[0] as Profile | undefined) ?? null)
  }

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      const uid = data.session?.user.id ?? null
      setUserId(uid)
      await loadProfile(uid)
      if (alive) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user.id ?? null
      setUserId(uid)
      void loadProfile(uid)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  return (
    <Ctx.Provider value={{
      loading, userId, profile,
      refreshProfile: () => loadProfile(userId),
      signOut: async () => { await supabase.auth.signOut() },
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
