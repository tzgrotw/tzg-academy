import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { IconCheck, IconClipboard } from './icons'
import type { Assessment, AssessmentSubmission, QuizQuestionPublic } from '../lib/types'

type QuizResult = { score_pct: number; passed: boolean }

/** 章節底下的測驗／作業區塊——quiz 走 RPC 自動評分，assignment 上傳檔案給管理員審。
 *  沒登入就只顯示標題＋說明，引導去註冊（跟教材列同一套邏輯）。 */
export function AssessmentBlock({ assessment, submission, userId, onSubmitQuiz, onSubmitAssignment }: {
  assessment: Assessment
  submission: AssessmentSubmission | null
  userId: string | null
  onSubmitQuiz: (answers: Record<number, number>) => Promise<{ error: string | null; result: QuizResult | null }>
  onSubmitAssignment: (filePath: string, note: string) => Promise<string | null>
}) {
  if (!userId) {
    return (
      <div className="lesson">
        <AssessHeader assessment={assessment} submission={null} />
        {assessment.instructions && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{assessment.instructions}</p>}
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>登入後才能作答／繳交。</p>
      </div>
    )
  }
  return assessment.kind === 'quiz'
    ? <QuizBlock assessment={assessment} submission={submission} onSubmit={onSubmitQuiz} />
    : <AssignmentBlock assessment={assessment} submission={submission} userId={userId} onSubmit={onSubmitAssignment} />
}

function AssessHeader({ assessment, submission }: { assessment: Assessment; submission: AssessmentSubmission | null }) {
  return (
    <h3 className="i" style={{ gap: 10 }}>
      <IconClipboard size={16} />{assessment.title}
      {submission && (
        <span className={`statuschip ${submission.status}`} style={{ marginLeft: 4 }}>
          {submission.status === 'passed' ? '通過' : submission.status === 'failed'
            ? (assessment.kind === 'quiz' ? '未通過' : '已退回') : '待審核'}
        </span>
      )}
    </h3>
  )
}

function QuizBlock({ assessment, submission, onSubmit }: {
  assessment: Assessment
  submission: AssessmentSubmission | null
  onSubmit: (answers: Record<number, number>) => Promise<{ error: string | null; result: QuizResult | null }>
}) {
  const [questions, setQuestions] = useState<QuizQuestionPublic[]>([])
  const [loaded, setLoaded] = useState(false)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [retry, setRetry] = useState(false)

  useEffect(() => {
    let alive = true
    supabase.rpc('fn_quiz_questions', { p_assessment_id: assessment.id }).then(({ data }) => {
      if (!alive) return
      setQuestions(((data as QuizQuestionPublic[] | null) ?? []).slice().sort((a, b) => a.sort_no - b.sort_no))
      setLoaded(true)
    })
    return () => { alive = false }
  }, [assessment.id])

  const alreadyDone = submission && submission.status !== 'pending' && !retry

  async function submit() {
    if (Object.keys(answers).length < questions.length) { setErr('還有題目沒作答'); return }
    setBusy(true); setErr(null)
    const { error, result: r } = await onSubmit(answers)
    setBusy(false)
    if (error) { setErr(error); return }
    setResult(r); setRetry(false)
  }

  return (
    <div className="lesson">
      <AssessHeader assessment={assessment} submission={alreadyDone ? submission : null} />
      {assessment.instructions && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{assessment.instructions}</p>}

      {alreadyDone && submission && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 13.5 }}>
            {submission.status === 'passed'
              ? <span className="i" style={{ color: '#2F6B2F' }}><IconCheck size={13} />通過了！</span>
              : '這次還沒到及格分數。'}
            ・得分 {submission.score_pct}%（及格線 {assessment.pass_pct}%）
          </p>
          <button className="btn-line" style={{ marginTop: 10 }}
            onClick={() => { setRetry(true); setAnswers({}); setResult(null) }}>重新作答</button>
        </div>
      )}

      {!alreadyDone && (
        <>
          {!loaded && <div className="skel" style={{ marginTop: 14 }} />}
          {loaded && questions.length === 0 && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>測驗還沒有題目。</p>}
          {loaded && questions.map((q, qi) => (
            <div key={q.id} style={{ marginTop: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 700 }}>{qi + 1}. {q.question}</p>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.options.map((opt, oi) => (
                  <label key={oi} className={`quiz-opt${answers[q.id] === oi ? ' on' : ''}`}>
                    <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === oi}
                      onChange={() => setAnswers(a => ({ ...a, [q.id]: oi }))} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {loaded && questions.length > 0 && (
            <button className="btn btn-m" style={{ marginTop: 18 }} disabled={busy} onClick={() => void submit()}>
              {busy ? '送出中…' : '送出答案'}
            </button>
          )}
          {err && <p className="formerr">{err}</p>}
          {result && (
            <p style={{ marginTop: 12, fontSize: 13.5 }}>
              {result.passed
                ? <span className="i" style={{ color: '#2F6B2F' }}><IconCheck size={13} />通過了！</span>
                : '還沒到及格分數，可以重新作答。'}
              ・得分 {result.score_pct}%
            </p>
          )}
        </>
      )}
    </div>
  )
}

function AssignmentBlock({ assessment, submission, userId, onSubmit }: {
  assessment: Assessment
  submission: AssessmentSubmission | null
  userId: string
  onSubmit: (filePath: string, note: string) => Promise<string | null>
}) {
  const [note, setNote] = useState(submission?.note ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!file && !submission?.file_path) { setErr('請先選檔案'); return }
    setBusy(true); setErr(null)
    try {
      let filePath = submission?.file_path ?? ''
      if (file) {
        filePath = `${userId}/${assessment.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
        const { error } = await supabase.storage.from('assignment-submissions').upload(filePath, file, { upsert: true })
        if (error) throw new Error(error.message)
      }
      const e = await onSubmit(filePath, note)
      if (e) throw new Error(e)
      setFile(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '繳交失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lesson">
      <AssessHeader assessment={assessment} submission={submission} />
      {assessment.instructions && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{assessment.instructions}</p>}

      {submission?.status === 'failed' && submission.feedback && (
        <p className="formerr" style={{ marginTop: 10 }}>管理員退回：{submission.feedback}</p>
      )}
      {submission?.status === 'passed' && submission.feedback && (
        <p className="notebox" style={{ marginTop: 10 }}>{submission.feedback}</p>
      )}

      {submission?.status !== 'passed' && (
        <div style={{ marginTop: 14 }}>
          <label className="btn-line" style={{ cursor: 'pointer', display: 'inline-block' }}>
            {file ? file.name : submission?.file_path ? '換一個檔案' : '選擇檔案'}
            <input type="file" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <textarea className="note-ta" value={note} onChange={e => setNote(e.target.value)} placeholder="附上說明（選填）" />
          <button className="btn btn-m" style={{ marginTop: 10 }} disabled={busy} onClick={() => void submit()}>
            {busy ? '繳交中…' : submission ? '重新繳交' : '繳交作業'}
          </button>
          {err && <p className="formerr">{err}</p>}
        </div>
      )}
    </div>
  )
}
