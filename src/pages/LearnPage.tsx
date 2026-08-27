import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Page } from '../components/Shell'
import { VideoRow, DocRow } from '../components/MaterialRow'
import { AssessmentBlock } from '../components/AssessmentBlock'
import { useCatalog } from '../hooks/useCatalog'
import { useProgress } from '../hooks/useProgress'
import { useSubmissions } from '../hooks/useSubmissions'
import { useAuth } from '../hooks/useAuth'
import { usePurchases } from '../hooks/usePurchases'
import { supabase } from '../lib/supabase'
import { canAccess } from '../lib/tier'
import { isDone, playable } from '../lib/progress'
import { IconCheck, IconLightbulb, IconLock } from '../components/icons'
import { CatalogError } from '../components/CatalogError'
import type { Section } from '../lib/types'

// 上課頁——章節橫幅＋小節內文＋影片列＋筆記＋上一章/下一章。
// 內容（sections）在這裡才撈：RLS 守門，沒權限撈到的就是空的。
export function LearnPage() {
  const { chapterKey } = useParams()
  const { userId, profile, loading: authLoading } = useAuth()
  const cat = useCatalog()
  const { progressOf, mark, prog } = useProgress(userId)
  const { submissionOf, submitQuiz, submitAssignment } = useSubmissions(userId)
  const { purchased } = usePurchases()

  const [sections, setSections] = useState<Section[]>([])
  const [secLoaded, setSecLoaded] = useState(false)

  const chapter = cat.chapters.find(c => c.key === chapterKey) ?? null
  const course = chapter ? cat.courses.find(c => c.id === chapter.course_id) ?? null : null
  const chapters = course ? cat.chaptersOf(course.id) : []
  // chapters（僅 is_active）找不到時，代表這是管理員在預覽未上架的章節——
  // 改從該課程全部章節（含未上架）依相同排序算章節號，不要讓畫面顯示「第 0 章」。
  const chNo = chapters.find(c => c.key === chapterKey)?.no ?? (course
    ? cat.chapters
        .filter(c => c.course_id === course.id)
        .sort((a, b) => a.sort_no - b.sort_no || a.key.localeCompare(b.key))
        .findIndex(c => c.key === chapterKey) + 1
    : 0)

  useEffect(() => {
    let alive = true
    if (!chapterKey) return
    setSecLoaded(false)
    supabase.from('course_sections').select('*')
      .eq('chapter_key', chapterKey).order('sort_no').order('id')
      .then(({ data }) => {
        if (!alive) return
        setSections(((data as Section[] | null) ?? []).filter(s => s.is_active))
        setSecLoaded(true)
      })
    return () => { alive = false }
  }, [chapterKey])

  // 筆記（登入才有）：離開頁面或停打 1.5 秒自動存
  const [note, setNote] = useState('')
  const [noteLoaded, setNoteLoaded] = useState(false)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    let alive = true
    if (!userId || !chapterKey) { setNoteLoaded(true); return }
    supabase.from('course_notes').select('*').eq('chapter_key', chapterKey)
      .then(({ data }) => {
        if (!alive) return
        setNote(((data as { body: string }[] | null)?.[0]?.body) ?? '')
        setNoteLoaded(true)
      })
    return () => { alive = false }
  }, [userId, chapterKey])
  const saveNote = (body: string) => {
    setNote(body)
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => {
      if (userId && chapterKey) void supabase.from('course_notes')
        .upsert({ user_id: userId, chapter_key: chapterKey, body, updated_at: new Date().toISOString() })
    }, 1500)
  }

  const mats = useMemo(
    () => cat.materials
      .filter(m => m.chapter_key === chapterKey && m.is_active)
      .sort((a, b) => a.sort_no - b.sort_no || a.id - b.id),
    [cat.materials, chapterKey])
  const assessments = useMemo(
    () => cat.assessments
      .filter(a => a.chapter_key === chapterKey && a.is_active)
      .sort((a, b) => a.sort_no - b.sort_no || a.id - b.id),
    [cat.assessments, chapterKey])
  const vids = playable(mats)
  const doneCnt = vids.filter(v => isDone(progressOf(v.id))).length
  void prog   // 讓進度更新時重繪列清單
  const pct = vids.length > 0 ? Math.round((doneCnt / vids.length) * 100) : 0

  const loading = !cat.loaded || authLoading
  if (loading) return <Page><div className="wrap"><div className="skel" style={{ marginTop: 40 }} /></div></Page>
  if (cat.error) return <Page><div className="wrap"><CatalogError message={cat.error} retry={cat.reload} /></div></Page>
  if (!chapter || !course) return <Navigate to="/courses" replace />

  // 沒權限：不白屏、不裝死——說清楚下一步
  if (!canAccess(course, profile?.tier ?? null, purchased.has(course.id))) {
    return (
      <Page><div className="wrap"><div className="locknote">
        <h3 className="i"><IconLock size={17} />這一章是{course.price_twd > 0 ? '購課學員' : course.audience === 'agent' ? '代理專屬' : '會員'}內容</h3>
        <p>{course.price_twd > 0 ? '完成購課後這裡立刻解鎖。' : userId ? '聯繫學院開通身分，整套課程一次打開。' : '免費註冊就能開始上公開課；進階課入會解鎖。'}</p>
        <p style={{ marginTop: 16 }}>
          {!userId && <Link className="btn btn-m" to="/register">免費註冊</Link>}
          {userId && <Link className="btn btn-m" to={`/course/${course.id}`}>回課程介紹</Link>}
        </p>
      </div></div></Page>
    )
  }

  const idx = chapters.findIndex(c => c.key === chapterKey)
  const prev = idx > 0 ? chapters[idx - 1] : null
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null

  return (
    <Page>
      <div className="wrap learn">
        <aside className="lnav">
          {chapters.map(c => {
            const rows = playable(cat.materials.filter(m => m.chapter_key === c.key && m.is_active))
            const d = rows.filter(v => isDone(progressOf(v.id))).length
            return (
              <Link key={c.key} to={`/learn/${c.key}`} className={c.key === chapterKey ? 'on' : ''}>
                <b>第 {c.no} 章</b>・{c.title}
                <small className={d === rows.length && rows.length > 0 ? 'i' : ''}>
                  {rows.length === 0 ? '—' : d === rows.length ? <><IconCheck size={11} />全部看完</> : `${d}/${rows.length} 支看完`}
                </small>
              </Link>
            )
          })}
        </aside>

        <main>
          <div className="lban">
            {chapter.cover_url && <img src={chapter.cover_url} alt="" />}
            <div className="veil" />
            <div className="in">
              <p className="ch">第 {chNo} 章</p>
              <h2 className="serif">{chapter.title}</h2>
              {vids.length > 0 && (
                <div className="pr">
                  <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                  <span>{doneCnt}/{vids.length} 支看完・{pct}%</span>
                </div>
              )}
            </div>
          </div>

          {!secLoaded && <div className="skel" />}
          {secLoaded && sections.map(s => (
            <div key={s.id} className="lesson">
              <h3>{s.heading}</h3>
              {s.items.length > 0 && (
                <div className="pts">{s.items.map((it, i) => <div key={i}><i />{it}</div>)}</div>
              )}
              {s.note && <div className="notebox i"><IconLightbulb size={15} />{s.note}</div>}
            </div>
          ))}

          {mats.length > 0 && (
            <div className="lesson">
              <h3>這一章的教材</h3>
              {!userId && (
                <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                  <Link to="/register" style={{ color: 'var(--magenta)', fontWeight: 700 }}>免費註冊</Link> 之後就能播影片、自動記進度。
                </p>
              )}
              {userId && mats.map(m =>
                m.kind === 'video'
                  ? <VideoRow key={m.id} video={m} progress={progressOf(m.id)} onProgress={mark} />
                  : m.kind === 'doc' ? <DocRow key={m.id} doc={m} /> : null)}
            </div>
          )}

          {userId && assessments.map(a => (
            <AssessmentBlock key={a.id} assessment={a} submission={submissionOf(a.id)} userId={userId}
              onSubmitQuiz={answers => submitQuiz(a.id, answers)}
              onSubmitAssignment={(filePath, note) => submitAssignment(a.id, filePath, note)} />
          ))}

          {secLoaded && sections.length === 0 && mats.length === 0 && assessments.length === 0 && (
            <div className="lesson"><h3>內容準備中</h3>
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>這一章還在建——建好會出現在這裡。</p></div>
          )}

          {userId && noteLoaded && (
            <div className="lesson">
              <h3>我的筆記</h3>
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>只有妳自己看得到・停筆自動儲存</p>
              <textarea className="note-ta" value={note} onChange={e => saveNote(e.target.value)}
                placeholder="這一章想記下來的……" />
            </div>
          )}

          <div className="pn">
            {prev
              ? <Link className="prev" to={`/learn/${prev.key}`}><small>上一章</small>{prev.title}</Link>
              : <Link className="prev" to={`/course/${course.id}`}><small>回課程</small>{course.title}</Link>}
            {next
              ? <Link className="next" to={`/learn/${next.key}`}><small>下一章</small>{next.title} →</Link>
              : <Link className="next" to={`/course/${course.id}`}><small>最後一章了</small>回課程看進度 →</Link>}
          </div>
        </main>
      </div>
    </Page>
  )
}
