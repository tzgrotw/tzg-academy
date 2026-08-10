import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Page } from '../components/Shell'
import { useAuth } from '../hooks/useAuth'
import { useAdminMembers } from '../hooks/useAdminMembers'
import { useAdminContent } from '../hooks/useAdminContent'
import { useAdminSubmissions } from '../hooks/useAdminSubmissions'
import { useAdminTrash } from '../hooks/useAdminTrash'
import { supabase } from '../lib/supabase'
import { AUDIENCE_LABEL, TIER_LABEL } from '../lib/tier'
import { IconCheck, IconChevron, IconFileText, IconFilm, IconTrash } from '../components/icons'
import { ConfirmProvider, useConfirm } from '../components/ConfirmDialog'
import { commitOrder, DragHandle, SortableList, type DragHandleProps } from '../components/Sortable'
import type { Assessment, AssessmentKind, AssessmentSubmission, Audience, Chapter, Course, Material, QuizQuestion, Section, Tier } from '../lib/types'

// 後台——四個分頁：會員（搜尋＋一鍵改身分）、課程（課程列表 → 點進去看該課的章節/教材/測驗）、作業批改、垃圾桶。
// 課程結構跟課程設定分開兩塊；排序用拖曳（SortableList）；刪除都走 ConfirmDialog 確認，砍下去是軟刪除
// （進垃圾桶，不是真的沒了）——誤刪從垃圾桶分頁救得回來。
// 資料存取都在 hooks/useAdminMembers、useAdminContent、useAdminSubmissions、useAdminTrash；這裡只管畫面。

export function AdminPage() {
  const { profile, loading } = useAuth()
  const [tab, setTab] = useState<'members' | 'content' | 'grading' | 'trash'>('members')

  if (loading) return <Page><div className="wrap"><div className="skel" style={{ marginTop: 40 }} /></div></Page>
  if (profile?.tier !== 'admin') return <Navigate to="/" replace />

  return (
    <ConfirmProvider>
      <Page>
        <div className="wrap" style={{ paddingBottom: 90 }}>
          <div className="admin-hd">
            <h1 className="serif">學院後台</h1>
            <div className="admin-tabs">
              <button className={tab === 'members' ? 'on' : ''} onClick={() => setTab('members')}>會員</button>
              <button className={tab === 'content' ? 'on' : ''} onClick={() => setTab('content')}>課程</button>
              <button className={tab === 'grading' ? 'on' : ''} onClick={() => setTab('grading')}>作業批改</button>
              <button className={tab === 'trash' ? 'on' : ''} onClick={() => setTab('trash')}>垃圾桶</button>
            </div>
          </div>
          {tab === 'members' ? <MembersTab /> : tab === 'content' ? <ContentTab />
            : tab === 'grading' ? <GradingTab /> : <TrashTab />}
        </div>
      </Page>
    </ConfirmProvider>
  )
}

/* ───────────────────────── 會員 ───────────────────────── */

function MembersTab() {
  const { rows, loaded, q, setQ, shown, busyId, setTier } = useAdminMembers()

  return (
    <div className="acard">
      <h3>會員（{rows.length}）</h3>
      <div className="searchbar">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜名字或 Email…" />
      </div>
      {!loaded && <div className="skel" />}
      {loaded && shown.length === 0 && <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>沒有符合的會員。</p>}
      {shown.map(p => (
        <div className="arow" key={p.user_id}>
          <div className="grow">
            <b>{p.name || '（沒填名字）'}</b>
            <span className="sub">{p.email}・{new Date(p.created_at).toLocaleDateString('zh-TW')} 加入</span>
          </div>
          <span className={`tierchip ${p.tier}`}>{TIER_LABEL[p.tier]}</span>
          {(['member', 'agent', 'admin'] as Tier[]).filter(t => t !== p.tier).map(t => (
            <button key={t} className="btn-line" disabled={busyId === p.user_id}
              onClick={() => void setTier(p, t)}>改成{TIER_LABEL[t]}</button>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ───────────────────────── 課程：課程列表 → 課程詳細 ───────────────────────── */

type AdminContent = ReturnType<typeof useAdminContent>
type Confirm = ReturnType<typeof useConfirm>

function ContentTab() {
  const content = useAdminContent()
  const confirm = useConfirm()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const sortedCourses = [...content.courses].sort((a, b) => a.sort_no - b.sort_no || a.id - b.id)
  const selected = sortedCourses.find(c => c.id === selectedId) ?? null

  async function createCourse() {
    setMsg(await content.createCourse())
  }

  async function deleteCourse(course: Course) {
    const ok = await confirm(`確定要刪除「${course.title}」？裡面的章節、教材會一起砍掉，不能復原。`, { danger: true })
    if (!ok) return
    setMsg(await content.deleteCourse(course.id))
  }

  function reorderCourses(newOrder: Course[]) {
    commitOrder(newOrder, (c, sortNo) => void content.updateCourse(c.id, { sort_no: sortNo }))
  }

  if (selected) {
    return <CourseDetail key={selected.id} course={selected} content={content} confirm={confirm}
      onBack={() => setSelectedId(null)} />
  }

  return (
    <>
      {msg && <p className="formerr">{msg}</p>}
      <div className="acard">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ flex: 1 }}>課程（{content.courses.length}）</h3>
          <button className="btn btn-s" onClick={() => void createCourse()}>＋開新課程</button>
        </div>
        {!content.loaded && <div className="skel" />}
        {content.loaded && sortedCourses.length === 0 && (
          <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>還沒有課程，點右上角開一門。</p>
        )}
        <SortableList items={sortedCourses} getId={c => String(c.id)} onReorder={reorderCourses}>
          {(c, handle) => (
            <div className="curr-row">
              <DragHandle {...handle} />
              <div className="grow" onClick={() => setSelectedId(c.id)}>
                <b>{c.title}</b>
                <span className="sub">
                  {AUDIENCE_LABEL[c.audience]}・{content.chapters.filter(ch => ch.course_id === c.id).length} 章{c.is_active ? '' : '・已下架'}
                </span>
              </div>
              <button className="icon-btn danger" title="刪除課程" onClick={() => void deleteCourse(c)}><IconTrash size={16} /></button>
              <span onClick={() => setSelectedId(c.id)} style={{ cursor: 'pointer', color: 'var(--tx-muted)' }}><IconChevron size={16} /></span>
            </div>
          )}
        </SortableList>
      </div>
    </>
  )
}

function CourseDetail({ course, content, confirm, onBack }: {
  course: Course
  content: AdminContent
  confirm: Confirm
  onBack: () => void
}) {
  const [title, setTitle] = useState(course.title)
  const [tagline, setTagline] = useState(course.tagline)
  const [audience, setAudience] = useState<Audience>(course.audience)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save(patch: Partial<Course>) {
    setBusy(true); setErr(null)
    setErr(await content.updateCourse(course.id, patch))
    setBusy(false)
  }

  async function uploadCover(file: File) {
    setBusy(true); setErr(null)
    setErr(await content.uploadCourseCover(course.id, file))
    setBusy(false)
  }

  const chapters = content.chapters.filter(ch => ch.course_id === course.id).sort((a, b) => a.sort_no - b.sort_no)

  async function addChapter() {
    setErr(await content.addChapter(course.id, chapters.at(-1)?.sort_no ?? 0))
  }

  function reorderChapters(newOrder: Chapter[]) {
    commitOrder(newOrder, (c, sortNo) => void content.updateChapter(c.key, { sort_no: sortNo }))
  }

  return (
    <div className="acard">
      <button className="curr-back" onClick={onBack}>
        <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><IconChevron size={14} /></span>回課程列表
      </button>

      <div className="curr-section">
        <div className="curr-section-hd"><h4>課程設定</h4></div>
        <div className="inline-form" style={{ marginTop: 0 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ minWidth: 220 }} placeholder="課名" />
          <input value={tagline} onChange={e => setTagline(e.target.value)} style={{ flex: 1, minWidth: 220 }} placeholder="一句話介紹" />
          <select value={audience} onChange={e => setAudience(e.target.value as Audience)}>
            <option value="public">公開・免費</option>
            <option value="member">會員課程</option>
            <option value="agent">代理專屬</option>
          </select>
          <button className="btn btn-s" disabled={busy} onClick={() => void save({ title, tagline, audience })}>存</button>
          <label className="btn-line" style={{ cursor: 'pointer' }}>
            {course.cover_url ? '換封面' : '＋放封面（橫圖）'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadCover(f) }} />
          </label>
          <button className="btn-line" disabled={busy} onClick={() => void save({ is_active: !course.is_active })}>
            {course.is_active ? '下架' : '重新上架'}
          </button>
        </div>
        {err && <p className="formerr">{err}</p>}
      </div>

      <div className="curr-section">
        <div className="curr-section-hd"><h4>章節（{chapters.length}）</h4></div>
        <SortableList items={chapters} getId={c => c.key} onReorder={reorderChapters}>
          {(ch, handle) => <ChapterCard chapter={ch} handle={handle} content={content} confirm={confirm} />}
        </SortableList>
        <p style={{ marginTop: 12 }}>
          <button className="btn-line" onClick={() => void addChapter()}>＋加一章</button>
        </p>
      </div>
    </div>
  )
}

function ChapterCard({ chapter, handle, content, confirm }: {
  chapter: Chapter
  handle: DragHandleProps
  content: AdminContent
  confirm: Confirm
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(chapter.title)
  const [tagline, setTagline] = useState(chapter.tagline)
  const [sections, setSections] = useState<Section[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    supabase.from('course_sections').select('*').eq('chapter_key', chapter.key).order('sort_no')
      .then(({ data }) => { if (alive) setSections((data as Section[] | null) ?? []) })
    return () => { alive = false }
  }, [open, chapter.key])

  const materials = content.materials.filter(m => m.chapter_key === chapter.key).sort((a, b) => a.sort_no - b.sort_no)
  const assessments = content.assessments.filter(a => a.chapter_key === chapter.key).sort((a, b) => a.sort_no - b.sort_no)

  async function save(patch: Partial<Chapter>) {
    setBusy(true); setErr(null)
    setErr(await content.updateChapter(chapter.key, patch))
    setBusy(false)
  }

  async function uploadChapterCover(file: File) {
    setBusy(true); setErr(null)
    setErr(await content.uploadChapterCover(chapter.key, file))
    setBusy(false)
  }

  async function uploadMaterial(file: File, kind: 'video' | 'doc') {
    setBusy(true); setErr(null)
    setErr(await content.uploadMaterial(chapter.key, file, kind, materials.at(-1)?.sort_no ?? 0))
    setBusy(false)
  }

  const [ytUrl, setYtUrl] = useState('')
  const [ytLabel, setYtLabel] = useState('')
  async function addYoutube() {
    setBusy(true); setErr(null)
    const e = await content.addYoutubeMaterial(chapter.key, ytUrl, ytLabel, materials.at(-1)?.sort_no ?? 0)
    setErr(e)
    if (!e) { setYtUrl(''); setYtLabel('') }
    setBusy(false)
  }

  async function addSection() {
    const { data, error } = await supabase.from('course_sections').insert({
      chapter_key: chapter.key, heading: '新小節',
      sort_no: (sections.at(-1)?.sort_no ?? 0) + 10,
    }).select().single()
    if (error) { setErr(error.message); return }
    setSections(ss => [...ss, data as Section])
  }

  function reorderMaterials(newOrder: Material[]) {
    commitOrder(newOrder, (m, sortNo) => void content.updateMaterial(m.id, { sort_no: sortNo }))
  }

  function reorderAssessments(newOrder: Assessment[]) {
    commitOrder(newOrder, (a, sortNo) => void content.updateAssessment(a.id, { sort_no: sortNo }))
  }

  async function addAssessment(kind: AssessmentKind) {
    setErr(await content.addAssessment(chapter.key, kind, assessments.at(-1)?.sort_no ?? 0))
  }

  async function deleteAssessment(a: Assessment) {
    const ok = await confirm(`確定要刪除「${a.title}」這份${a.kind === 'quiz' ? '測驗' : '作業'}？學員的作答／繳交紀錄會一起砍掉，不能復原。`, { danger: true })
    if (!ok) return
    setErr(await content.deleteAssessment(a.id))
  }

  function reorderSections(newOrder: Section[]) {
    setSections(newOrder)
    commitOrder(newOrder, (s, sortNo) => {
      void supabase.from('course_sections').update({ sort_no: sortNo }).eq('id', s.id)
    })
  }

  async function deleteSection(section: Section) {
    const ok = await confirm(`確定要刪除「${section.heading}」這段小節內文？不能復原。`, { danger: true })
    if (!ok) return
    const { error } = await supabase.from('course_sections').delete().eq('id', section.id)
    if (error) { setErr(error.message); return }
    setSections(ss => ss.filter(s => s.id !== section.id))
  }

  async function deleteChapter() {
    const ok = await confirm(`確定要刪除「${chapter.title}」這一章？裡面的教材會一起砍掉，不能復原。`, { danger: true })
    if (!ok) return
    setErr(await content.deleteChapter(chapter.key))
  }

  async function deleteMaterial(m: Material) {
    const ok = await confirm(`確定要刪除「${m.label}」？不能復原。`, { danger: true })
    if (!ok) return
    setErr(await content.deleteMaterial(m.id))
  }

  return (
    <div className="chapter-card">
      <div className="chapter-hd">
        <DragHandle {...handle} />
        <div className="grow" onClick={() => setOpen(o => !o)}>
          <b style={{ fontSize: 13.5 }}>{chapter.title}</b>
          <span className="sub">{materials.length} 份教材{chapter.is_active ? '' : '・已停用'}</span>
        </div>
        <button className="icon-btn danger" title="刪除章節" onClick={() => void deleteChapter()}><IconTrash size={15} /></button>
        <span onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', color: 'var(--tx-muted)' }}><IconChevron size={15} open={open} /></span>
      </div>
      {open && (
        <div className="chapter-body">
          <div className="inline-form">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="章名" />
            <input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="一句話副標" style={{ flex: 1, minWidth: 180 }} />
            <button className="btn btn-s" disabled={busy} onClick={() => void save({ title, tagline })}>存</button>
            <label className="btn-line" style={{ cursor: 'pointer' }}>
              {chapter.cover_url ? '換章節封面' : '＋章節封面'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadChapterCover(f) }} />
            </label>
            <button className="btn-line" disabled={busy} onClick={() => void save({ is_active: !chapter.is_active })}>
              {chapter.is_active ? '停用' : '啟用'}
            </button>
          </div>

          <SortableList items={sections} getId={s => String(s.id)} onReorder={reorderSections}>
            {(s, sHandle) => <SectionEditor section={s} handle={sHandle} onDelete={() => void deleteSection(s)} />}
          </SortableList>

          <SortableList items={materials} getId={m => String(m.id)} onReorder={reorderMaterials}>
            {(m, mHandle) => (
              <MaterialAdminRow material={m} handle={mHandle}
                onToggle={() => content.toggleMaterial(m)}
                onDelete={() => void deleteMaterial(m)} />
            )}
          </SortableList>

          <div className="inline-form" style={{ marginTop: 10 }}>
            <button className="btn-line" onClick={() => void addSection()}>＋加小節內文</button>
            <label className="btn-line" style={{ cursor: 'pointer' }}>
              {busy ? '上傳中…' : '＋上傳影片'}
              <input type="file" accept="video/*" style={{ display: 'none' }} disabled={busy}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadMaterial(f, 'video') }} />
            </label>
            <label className="btn-line" style={{ cursor: 'pointer' }}>
              ＋上傳講義
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" style={{ display: 'none' }} disabled={busy}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadMaterial(f, 'doc') }} />
            </label>
          </div>
          <div className="inline-form" style={{ marginTop: 10 }}>
            <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="貼 YouTube 網址或影片 ID" style={{ minWidth: 220 }} />
            <input value={ytLabel} onChange={e => setYtLabel(e.target.value)} placeholder="這支影片的標題" style={{ flex: 1, minWidth: 180 }} />
            <button className="btn-line" disabled={busy || !ytUrl.trim()} onClick={() => void addYoutube()}>＋加 YouTube 影片</button>
          </div>
          {err && <p className="formerr">{err}</p>}

          <div className="curr-section-hd" style={{ marginTop: 20 }}><h4>測驗／作業（{assessments.length}）</h4></div>
          <SortableList items={assessments} getId={a => String(a.id)} onReorder={reorderAssessments}>
            {(a, aHandle) => (
              <AssessmentEditor assessment={a} handle={aHandle} content={content} confirm={confirm}
                onDelete={() => void deleteAssessment(a)} />
            )}
          </SortableList>
          <div className="inline-form" style={{ marginTop: 10 }}>
            <button className="btn-line" onClick={() => void addAssessment('quiz')}>＋加測驗</button>
            <button className="btn-line" onClick={() => void addAssessment('assignment')}>＋加作業</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── 測驗／作業編輯 ───────────────────────── */

function AssessmentEditor({ assessment, handle, content, confirm, onDelete }: {
  assessment: Assessment
  handle: DragHandleProps
  content: AdminContent
  confirm: Confirm
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(assessment.title)
  const [instructions, setInstructions] = useState(assessment.instructions)
  const [passPct, setPassPct] = useState(assessment.pass_pct)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setBusy(true); setSaved(false); setErr(null)
    const patch: Partial<Assessment> = { title, instructions }
    if (assessment.kind === 'quiz') patch.pass_pct = passPct
    const e = await content.updateAssessment(assessment.id, patch)
    setErr(e); setBusy(false)
    if (!e) setSaved(true)
  }

  async function toggleActive() {
    setErr(await content.updateAssessment(assessment.id, { is_active: !assessment.is_active }))
  }

  return (
    <div className="chapter-card" style={{ marginTop: 10 }}>
      <div className="chapter-hd">
        <DragHandle {...handle} />
        <span className={`kindchip ${assessment.kind}`}>{assessment.kind === 'quiz' ? '測驗' : '作業'}</span>
        <div className="grow" onClick={() => setOpen(o => !o)}>
          <b style={{ fontSize: 13.5 }}>{assessment.title}</b>
          <span className="sub">
            {assessment.is_active ? '' : '已停用・'}
            {assessment.kind === 'quiz' ? `答對 ${assessment.pass_pct}% 算過` : '學員上傳・管理員手動審核'}
          </span>
        </div>
        <button className="icon-btn danger" title="刪除" onClick={onDelete}><IconTrash size={15} /></button>
        <span onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', color: 'var(--tx-muted)' }}><IconChevron size={15} open={open} /></span>
      </div>
      {open && (
        <div className="chapter-body">
          <div className="inline-form" style={{ marginTop: 0 }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="標題" style={{ flex: 1, minWidth: 200 }} />
            {assessment.kind === 'quiz' && (
              <span className="i" style={{ fontSize: 13, gap: 6, display: 'inline-flex', alignItems: 'center' }}>
                及格
                <input type="number" min={0} max={100} value={passPct}
                  onChange={e => setPassPct(Number(e.target.value))} style={{ width: 64 }} />
                %
              </span>
            )}
            <button className="btn btn-s" disabled={busy} onClick={() => void save()}>{saved ? <><IconCheck size={13} />存好了</> : '存'}</button>
            <button className="btn-line" onClick={() => void toggleActive()}>{assessment.is_active ? '停用' : '啟用'}</button>
          </div>
          <textarea className="note-ta" style={{ minHeight: 60 }} value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder={assessment.kind === 'quiz' ? '測驗說明（選填）' : '作業說明——要交什麼、格式、注意事項'} />
          {err && <p className="formerr">{err}</p>}
          {assessment.kind === 'quiz' && <QuizQuestionEditor assessmentId={assessment.id} confirm={confirm} />}
        </div>
      )}
    </div>
  )
}

function QuizQuestionEditor({ assessmentId, confirm }: { assessmentId: number; confirm: Confirm }) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    supabase.from('quiz_questions').select('*').eq('assessment_id', assessmentId).order('sort_no').order('id')
      .then(({ data }) => { if (alive) { setQuestions((data as QuizQuestion[] | null) ?? []); setLoaded(true) } })
    return () => { alive = false }
  }, [assessmentId])

  async function addQuestion() {
    const { data, error } = await supabase.from('quiz_questions').insert({
      assessment_id: assessmentId, question: '新題目', options: ['選項一', '選項二'], correct_index: 0,
      sort_no: (questions.at(-1)?.sort_no ?? 0) + 10,
    }).select().single()
    if (error) { setErr(error.message); return }
    setQuestions(qs => [...qs, data as QuizQuestion])
  }

  function reorder(newOrder: QuizQuestion[]) {
    setQuestions(newOrder)
    commitOrder(newOrder, (q, sortNo) => { void supabase.from('quiz_questions').update({ sort_no: sortNo }).eq('id', q.id) })
  }

  async function deleteQuestion(q: QuizQuestion) {
    const ok = await confirm('確定要刪除這一題？不能復原。', { danger: true })
    if (!ok) return
    const { error } = await supabase.from('quiz_questions').delete().eq('id', q.id)
    if (error) { setErr(error.message); return }
    setQuestions(qs => qs.filter(x => x.id !== q.id))
  }

  function patchLocal(id: number, patch: Partial<QuizQuestion>) {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...patch } : q))
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="curr-section-hd"><h4>題目（{questions.length}）</h4></div>
      {!loaded && <div className="skel" />}
      {loaded && questions.length === 0 && <p className="muted" style={{ fontSize: 13 }}>還沒有題目，點下面加一題。</p>}
      <SortableList items={questions} getId={q => String(q.id)} onReorder={reorder}>
        {(q, qHandle) => (
          <QuestionRow question={q} handle={qHandle} onPatch={patchLocal} onDelete={() => void deleteQuestion(q)} />
        )}
      </SortableList>
      <p style={{ marginTop: 10 }}><button className="btn-line" onClick={() => void addQuestion()}>＋加一題</button></p>
      {err && <p className="formerr">{err}</p>}
    </div>
  )
}

function QuestionRow({ question, handle, onPatch, onDelete }: {
  question: QuizQuestion
  handle: DragHandleProps
  onPatch: (id: number, patch: Partial<QuizQuestion>) => void
  onDelete: () => void
}) {
  const [text, setText] = useState(question.question)
  const [options, setOptions] = useState(question.options)
  const [correct, setCorrect] = useState(question.correct_index)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setBusy(true); setSaved(false); setErr(null)
    const cleanOptions = options.map(o => o.trim()).filter(Boolean)
    if (cleanOptions.length < 2) { setErr('至少要有兩個選項'); setBusy(false); return }
    const fixedCorrect = Math.min(correct, cleanOptions.length - 1)
    const { error } = await supabase.from('quiz_questions')
      .update({ question: text, options: cleanOptions, correct_index: fixedCorrect }).eq('id', question.id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setOptions(cleanOptions); setCorrect(fixedCorrect); setSaved(true)
    onPatch(question.id, { question: text, options: cleanOptions, correct_index: fixedCorrect })
  }

  function updateOption(i: number, v: string) {
    setOptions(os => os.map((o, idx) => idx === i ? v : o))
  }
  function addOption() {
    setOptions(os => [...os, ''])
  }
  function removeOption(i: number) {
    setOptions(os => os.filter((_, idx) => idx !== i))
    setCorrect(c => (c === i ? 0 : c > i ? c - 1 : c))
  }

  return (
    <div style={{ background: '#FBF8EF', borderRadius: 12, padding: '12px 14px', marginTop: 10 }}>
      <div className="inline-form" style={{ marginTop: 0 }}>
        <DragHandle {...handle} />
        <input value={text} onChange={e => setText(e.target.value)} placeholder="題目" style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn-s" disabled={busy} onClick={() => void save()}>{saved ? <><IconCheck size={13} />存好了</> : '存'}</button>
        <button className="icon-btn danger" title="刪除這題" onClick={onDelete}><IconTrash size={14} /></button>
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name={`correct-${question.id}`} checked={correct === i}
              onChange={() => setCorrect(i)} title="標成正確答案" />
            <input value={opt} onChange={e => updateOption(i, e.target.value)} placeholder={`選項 ${i + 1}`}
              style={{ flex: 1, border: '1px solid rgba(197,179,130,.55)', borderRadius: 10, padding: '7px 10px', font: 'inherit', fontSize: 13, background: '#FFFDF7' }} />
            {options.length > 2 && (
              <button className="icon-btn danger" title="刪除選項" onClick={() => removeOption(i)}><IconTrash size={13} /></button>
            )}
          </div>
        ))}
      </div>
      <button className="btn-line" style={{ marginTop: 8 }} onClick={addOption}>＋加選項</button>
      <p style={{ marginTop: 4, fontSize: 11.5, color: 'var(--tx-muted)' }}>圈選左邊的圓點標記正確答案</p>
      {err && <p className="formerr">{err}</p>}
    </div>
  )
}

function SectionEditor({ section, handle, onDelete }: { section: Section; handle: DragHandleProps; onDelete: () => void }) {
  const [heading, setHeading] = useState(section.heading)
  const [items, setItems] = useState(section.items.join('\n'))
  const [note, setNote] = useState(section.note ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setBusy(true); setSaved(false)
    await supabase.from('course_sections').update({
      heading, note: note || null,
      items: items.split('\n').map(s => s.trim()).filter(Boolean),
    }).eq('id', section.id)
    setBusy(false); setSaved(true)
  }

  return (
    <div style={{ background: '#FBF8EF', borderRadius: 12, padding: '12px 14px', marginTop: 10 }}>
      <div className="inline-form" style={{ marginTop: 0 }}>
        <DragHandle {...handle} />
        <input value={heading} onChange={e => setHeading(e.target.value)} placeholder="小節標題" style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn-s" disabled={busy} onClick={() => void save()}>{saved ? <><IconCheck size={13} />存好了</> : '存'}</button>
        <button className="icon-btn danger" title="刪除小節內文" onClick={onDelete}><IconTrash size={14} /></button>
      </div>
      <textarea className="note-ta" style={{ minHeight: 70 }} value={items} onChange={e => setItems(e.target.value)}
        placeholder={'條列重點——一行一點'} />
      <input style={{ width: '100%', border: '1px solid rgba(197,179,130,.55)', borderRadius: 10, padding: '9px 12px', font: 'inherit', fontSize: 13.5, background: '#FFFDF7', marginTop: 8 }}
        value={note} onChange={e => setNote(e.target.value)} placeholder="講師提醒（一句，可留空）" />
    </div>
  )
}

function MaterialAdminRow({ material, handle, onToggle, onDelete }: {
  material: Material
  handle: DragHandleProps
  onToggle: () => Promise<string | null>
  onDelete: () => void
}) {
  const [busy, setBusy] = useState(false)
  async function toggle() {
    setBusy(true)
    await onToggle()
    setBusy(false)
  }
  return (
    <div className="mat-row">
      <DragHandle {...handle} />
      <div className="grow i" style={{ fontSize: 13 }}>
        {material.kind === 'video' ? <IconFilm size={14} /> : <IconFileText size={14} />}
        <b>{material.label}</b>
        {!material.is_active && <span className="sub">已停用——學員看不到</span>}
      </div>
      <button className="btn-line" disabled={busy} onClick={() => void toggle()}>
        {material.is_active ? '停用' : '啟用'}
      </button>
      <button className="icon-btn danger" disabled={busy} title="刪除教材" onClick={onDelete}><IconTrash size={14} /></button>
    </div>
  )
}

/* ───────────────────────── 作業批改 ───────────────────────── */

function GradingTab() {
  const content = useAdminContent()
  const members = useAdminMembers()
  const subs = useAdminSubmissions()
  const [showAll, setShowAll] = useState(false)

  const assignments = content.assessments.filter(a => a.kind === 'assignment')
  const assignmentIds = new Set(assignments.map(a => a.id))
  const rows = subs.rows
    .filter(r => assignmentIds.has(r.assessment_id))
    .filter(r => showAll || r.status === 'pending')

  const loaded = content.loaded && members.loaded && subs.loaded

  return (
    <div className="acard">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h3 style={{ flex: 1 }}>作業批改</h3>
        <label className="i" style={{ fontSize: 13, gap: 6, display: 'inline-flex', alignItems: 'center', color: 'var(--tx-muted)' }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          顯示已批改的
        </label>
      </div>
      {!loaded && <div className="skel" />}
      {loaded && rows.length === 0 && (
        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          {showAll ? '還沒有任何作業繳交紀錄。' : '目前沒有待審核的作業——都批完了。'}
        </p>
      )}
      {rows.map(r => {
        const assessment = assignments.find(a => a.id === r.assessment_id)
        const chapter = assessment ? content.chapters.find(c => c.key === assessment.chapter_key) : null
        const course = chapter ? content.courses.find(c => c.id === chapter.course_id) : null
        const member = members.rows.find(p => p.user_id === r.user_id)
        return (
          <SubmissionRow key={`${r.user_id}:${r.assessment_id}`} submission={r}
            title={assessment?.title ?? '（測驗／作業已刪除）'}
            path={course ? `${course.title} ‹ ${chapter?.title ?? ''}` : ''}
            memberLabel={member ? `${member.name || '（沒填名字）'}・${member.email}` : r.user_id}
            fileUrl={subs.fileUrl} busy={subs.busyKey === `${r.user_id}:${r.assessment_id}`}
            onGrade={(status, feedback) => subs.grade(r.user_id, r.assessment_id, status, feedback)} />
        )
      })}
    </div>
  )
}

function SubmissionRow({ submission, title, path, memberLabel, fileUrl, busy, onGrade }: {
  submission: AssessmentSubmission
  title: string
  path: string
  memberLabel: string
  fileUrl: (path: string) => Promise<string | null>
  busy: boolean
  onGrade: (status: 'passed' | 'failed', feedback: string) => Promise<string | null>
}) {
  const [feedback, setFeedback] = useState(submission.feedback ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)

  async function openFile() {
    if (!submission.file_path) return
    setSigning(true)
    const url = await fileUrl(submission.file_path)
    setSigning(false)
    if (url) window.open(url, '_blank', 'noopener')
    else setErr('檔案連結產生失敗，再試一次')
  }

  async function grade(status: 'passed' | 'failed') {
    setErr(await onGrade(status, feedback))
  }

  const statusLabel = submission.status === 'pending' ? '待審核' : submission.status === 'passed' ? '通過' : '退回'

  return (
    <div className="arow" style={{ alignItems: 'flex-start' }}>
      <div className="grow">
        <b>{title}</b>
        <span className="sub">{path}・{memberLabel}</span>
        <span className="sub">{new Date(submission.submitted_at).toLocaleString('zh-TW')} 繳交・{statusLabel}</span>
        {submission.note && <p style={{ fontSize: 13, marginTop: 6, color: 'var(--tx-soft)' }}>{submission.note}</p>}
        <div className="inline-form" style={{ marginTop: 8 }}>
          {submission.file_path && (
            <button className="btn-line" disabled={signing} onClick={() => void openFile()}>
              {signing ? '產生連結中…' : '查看繳交檔案'}
            </button>
          )}
        </div>
        <textarea className="note-ta" style={{ minHeight: 50, marginTop: 8 }} value={feedback}
          onChange={e => setFeedback(e.target.value)} placeholder="給學員的評語（選填）" />
        {err && <p className="formerr">{err}</p>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn btn-s" disabled={busy} onClick={() => void grade('passed')}>通過</button>
        <button className="btn-line" disabled={busy} onClick={() => void grade('failed')}>退回</button>
      </div>
    </div>
  )
}

/* ───────────────────────── 垃圾桶 ───────────────────────── */

function TrashTab() {
  const trash = useAdminTrash()
  const confirm = useConfirm()
  const [err, setErr] = useState<string | null>(null)

  const total = trash.courses.length + trash.chapters.length + trash.materials.length + trash.assessments.length

  async function purge(label: string, fn: () => Promise<string | null>) {
    const ok = await confirm(`永久刪除「${label}」？垃圾桶清掉之後真的救不回來了。`, { danger: true })
    if (!ok) return
    setErr(await fn())
  }

  return (
    <div className="acard">
      <h3>垃圾桶{trash.loaded ? `（${total}）` : ''}</h3>
      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        後台刪除都是先進垃圾桶，不是馬上真的沒了——點「還原」救回來，或「永久刪除」才是真的清掉。
      </p>
      {!trash.loaded && <div className="skel" style={{ marginTop: 16 }} />}
      {trash.loaded && total === 0 && (
        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>垃圾桶是空的。</p>
      )}
      {err && <p className="formerr">{err}</p>}

      {trash.courses.length > 0 && (
        <>
          <div className="curr-section-hd" style={{ marginTop: 18 }}><h4>課程（{trash.courses.length}）</h4></div>
          {trash.courses.map(c => (
            <div className="arow" key={c.id}>
              <div className="grow">
                <b>{c.title}</b>
                <span className="sub">刪除於 {new Date(c.deleted_at ?? '').toLocaleString('zh-TW')}</span>
              </div>
              <button className="btn-line" onClick={() => void trash.restoreCourse(c.id).then(e => setErr(e))}>還原</button>
              <button className="icon-btn danger" title="永久刪除"
                onClick={() => void purge(c.title, () => trash.purgeCourse(c.id))}><IconTrash size={15} /></button>
            </div>
          ))}
        </>
      )}

      {trash.chapters.length > 0 && (
        <>
          <div className="curr-section-hd" style={{ marginTop: 18 }}><h4>章節（{trash.chapters.length}）</h4></div>
          {trash.chapters.map(c => (
            <div className="arow" key={c.key}>
              <div className="grow">
                <b>{c.title}</b>
                <span className="sub">{c.courseTitle}・刪除於 {new Date(c.deleted_at ?? '').toLocaleString('zh-TW')}</span>
              </div>
              <button className="btn-line" onClick={() => void trash.restoreChapter(c.key).then(e => setErr(e))}>還原</button>
              <button className="icon-btn danger" title="永久刪除"
                onClick={() => void purge(c.title, () => trash.purgeChapter(c.key))}><IconTrash size={15} /></button>
            </div>
          ))}
        </>
      )}

      {trash.materials.length > 0 && (
        <>
          <div className="curr-section-hd" style={{ marginTop: 18 }}><h4>教材（{trash.materials.length}）</h4></div>
          {trash.materials.map(m => (
            <div className="arow" key={m.id}>
              <div className="grow">
                <b>{m.label}</b>
                <span className="sub">{m.courseTitle} ‹ {m.chapterTitle}・刪除於 {new Date(m.deleted_at ?? '').toLocaleString('zh-TW')}</span>
              </div>
              <button className="btn-line" onClick={() => void trash.restoreMaterial(m.id).then(e => setErr(e))}>還原</button>
              <button className="icon-btn danger" title="永久刪除"
                onClick={() => void purge(m.label, () => trash.purgeMaterial(m.id))}><IconTrash size={15} /></button>
            </div>
          ))}
        </>
      )}

      {trash.assessments.length > 0 && (
        <>
          <div className="curr-section-hd" style={{ marginTop: 18 }}><h4>測驗／作業（{trash.assessments.length}）</h4></div>
          {trash.assessments.map(a => (
            <div className="arow" key={a.id}>
              <div className="grow">
                <b>{a.title}</b>
                <span className="sub">{a.courseTitle} ‹ {a.chapterTitle}・刪除於 {new Date(a.deleted_at ?? '').toLocaleString('zh-TW')}</span>
              </div>
              <button className="btn-line" onClick={() => void trash.restoreAssessment(a.id).then(e => setErr(e))}>還原</button>
              <button className="icon-btn danger" title="永久刪除"
                onClick={() => void purge(a.title, () => trash.purgeAssessment(a.id))}><IconTrash size={15} /></button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
