import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Certificate } from '../lib/types'

export function useCertificates(userId: string | null) {
  const [rows, setRows] = useState<Certificate[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!userId) { setRows([]); setLoaded(true); return }
    const { data } = await supabase.from('course_certificates')
      .select('certificate_no,verification_code,course_id,learner_name,course_title,certificate_title,issued_at,revoked_at')
      .order('issued_at', { ascending: false })
    setRows((data as Certificate[] | null) ?? [])
    setLoaded(true)
  }, [userId])

  useEffect(() => { void load() }, [load])

  const issue = useCallback(async (courseId: number) => {
    const { data, error } = await supabase.rpc('fn_issue_certificate', { p_course: courseId })
    if (error) return { certificate: null, error: error.message }
    const certificate = ((data as Certificate[] | null) ?? [])[0] ?? null
    if (certificate) setRows(current => current.some(c => c.certificate_no === certificate.certificate_no)
      ? current : [certificate, ...current])
    return { certificate, error: certificate ? null : '證書核發失敗，請稍後再試。' }
  }, [])

  return { rows, loaded, issue, reload: load }
}
