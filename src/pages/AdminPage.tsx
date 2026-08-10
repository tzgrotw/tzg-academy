import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Page } from '../components/Shell'
import { useAuth } from '../hooks/useAuth'
import { useAdminMembers } from '../hooks/useAdminMembers'
import { useAdminContent } from '../hooks/useAdminContent'
import { supabase } from '../lib/supabase'
import { AUDIENCE_LABEL, TIER_LABEL } from '../lib/tier'
import { IconCheck, IconChevron, IconFileText, IconFilm, IconTrash } from '../components/icons'
import { ConfirmProvider, useConfirm } from '../components/ConfirmDialog'
import { commitOrder, DragHandle, SortableList, type DragHandleProps } from '../components/Sortable'
import type { Audience, Chapter, Course, Material, Section, Tier } from '../lib/types'

// 後台——兩個分頁：會員（搜尋＋一鍵改身分）、課程（課程列表 → 點進去看該課的章節/教材）。
// 課程結構跟課程設定分開兩塊；排序用拖曳（SortableList）；刪除都走 ConfirmDialog，不用瀏覽器內建 confirm()。
// 資料存取都在 hooks/useAdminMembers、hooks/useAdminContent；這裡只管畫面。

export function AdminPage() {
  const { profile, loading } = useAuth()
  const [tab, setTab] = useState<'members' | 'content'>('members')

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
            </div>
          </div>
          {tab === 'members' ? <MembersTab /> : <ContentTab />}
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

          {sections.map(s => <SectionEditor key={s.id} section={s} />)}

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
        </div>
      )}
    </div>
  )
}

function SectionEditor({ section }: { section: Section }) {
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
        <input value={heading} onChange={e => setHeading(e.target.value)} placeholder="小節標題" style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn-s" disabled={busy} onClick={() => void save()}>{saved ? <><IconCheck size={13} />存好了</> : '存'}</button>
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
