import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AssessmentSubmission } from '../lib/types'

/** 後台「作業批改」分頁的資料層——admin 的 RLS 讓這裡撈得到全部人的繳交紀錄。
 *  評分只改 status/feedback，走一般 UPDATE（submissions_admin_grade policy 只放行 admin）。 */
export function useAdminSubmissions() {
  const [rows, setRows] = useState<AssessmentSubmission[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('assessment_submissions')
      .select('*').order('submitted_at', { ascending: false })
    setRows((data as AssessmentSubmission[] | null) ?? [])
    setLoaded(true)
  }, [])

  useEffect(() => { void load() }, [load])

  const grade = useCallback(async (userId: string, assessmentId: number, status: 'passed' | 'failed', feedback: string) => {
    const key = `${userId}:${assessmentId}`
    setBusyKey(key)
    const reviewed_at = new Date().toISOString()
    const { error } = await supabase.from('assessment_submissions')
      .update({ status, feedback: feedback.trim() || null, reviewed_at })
      .eq('user_id', userId).eq('assessment_id', assessmentId)
    setBusyKey(null)
    if (error) return error.message
    setRows(rs => rs.map(r => r.user_id === userId && r.assessment_id === assessmentId
      ? { ...r, status, feedback: feedback.trim() || null, reviewed_at } : r))
    return null
  }, [])

  const fileUrl = useCallback(async (filePath: string) => {
    const { data, error } = await supabase.storage.from('assignment-submissions').createSignedUrl(filePath, 600)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  }, [])

  return { rows, loaded, busyKey, grade, fileUrl }
}
