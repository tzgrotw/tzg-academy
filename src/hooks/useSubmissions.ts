import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AssessmentSubmission } from '../lib/types'

/** 個人測驗／作業繳交紀錄——撈自己的（量小），送出都走 SECURITY DEFINER RPC，
 *  不直接寫 assessment_submissions（不然學員能自己把 status 改成 passed）。 */
export function useSubmissions(userId: string | null) {
  const [rows, setRows] = useState<Record<number, AssessmentSubmission>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    if (!userId) { setRows({}); setLoaded(true); return }
    setLoaded(false)
    supabase.from('assessment_submissions').select('*').eq('user_id', userId).then(({ data }) => {
      if (!alive) return
      const map: Record<number, AssessmentSubmission> = {}
      for (const row of (data as AssessmentSubmission[] | null) ?? []) map[row.assessment_id] = row
      setRows(map)
      setLoaded(true)
    })
    return () => { alive = false }
  }, [userId])

  const submissionOf = useCallback((assessmentId: number): AssessmentSubmission | null =>
    rows[assessmentId] ?? null, [rows])

  const submitQuiz = useCallback(async (assessmentId: number, answers: Record<number, number>) => {
    const { data, error } = await supabase.rpc('fn_submit_quiz', {
      p_assessment_id: assessmentId,
      p_answers: answers,
    }).single()
    if (error) return { error: error.message, result: null }
    const r = data as { score_pct: number; passed: boolean }
    if (userId) {
      setRows(rs => ({
        ...rs,
        [assessmentId]: {
          user_id: userId, assessment_id: assessmentId, answers, score_pct: r.score_pct,
          file_path: null, note: null, status: r.passed ? 'passed' : 'failed', feedback: null,
          submitted_at: new Date().toISOString(), reviewed_at: new Date().toISOString(),
        },
      }))
    }
    return { error: null, result: r }
  }, [userId])

  const submitAssignment = useCallback(async (assessmentId: number, filePath: string, note: string) => {
    const { error } = await supabase.rpc('fn_submit_assignment', {
      p_assessment_id: assessmentId, p_file_path: filePath, p_note: note,
    })
    if (error) return error.message
    if (userId) {
      setRows(rs => ({
        ...rs,
        [assessmentId]: {
          user_id: userId, assessment_id: assessmentId, answers: null, score_pct: null,
          file_path: filePath, note, status: 'pending', feedback: null,
          submitted_at: new Date().toISOString(), reviewed_at: null,
        },
      }))
    }
    return null
  }, [userId])

  return { loaded, submissionOf, submitQuiz, submitAssignment }
}
