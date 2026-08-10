import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Page } from '../components/Shell'
import { useAuth } from '../hooks/useAuth'
import { useAdminMembers } from '../hooks/useAdminMembers'
import { useAdminContent } from '../hooks/useAdminContent'
import { supabase } from '../lib/supabase'
import { AUDIENCE_LABEL, TIER_LABEL } from '../lib/tier'
import { IconCheck, IconFileText, IconFilm } from '../components/icons'
import type { Audience, Chapter, Course, Material, Section, Tier } from '../lib/types'

// 後台——兩個分頁：會員（搜尋＋一鍵改身分）、課程（課→章→節/教材，逐層展開）。
// 精簡版原則：一列一件事、存了馬上生效、錯了講清楚哪裡錯。
// 資料存取都在 hooks/useAdminMembers、hooks/useAdminContent；這裡只管畫面。

export function AdminPage() {
  const { profile, loading } = useAuth()
  const [tab, setTab] = useState<'members' | 'content'>('members')

  if (loading) return <Page><div className="wrap"><div className="skel" style={{ marginTop: 40 }} /></div></Page>
  if (profile?.tier !== 'admin') return <Navigate to="/" replace />

  return (
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

/* ───────────────────────── 課程 ───────────────────────── */

type AdminContent = ReturnType<typeof useAdminContent>

function ContentTab() {
  const content = useAdminContent()
  const [openCourse, setOpenCourse] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function createCourse() {
    setMsg(await content.createCourse())
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
        {content.courses.map(c => (
          <CourseEditor key={c.id} course={c}
            chapters={content.chapters.filter(ch => ch.course_id === c.id).sort((a, b) => a.sort_no - b.sort_no)}
            materials={content.materials}
            open={openCourse === c.id}
            onToggle={() => setOpenCourse(openCourse === c.id ? null : c.id)}
            content={content} />
        ))}
      </div>
    </>
  )
}

function CourseEditor({ course, chapters, materials, open, onToggle, content }: {
  course: Course
  chapters: Chapter[]
  materials: Material[]
  open: boolean
  onToggle: () => void
  content: AdminContent
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

  async function addChapter() {
    setErr(null)
    setErr(await content.addChapter(course.id, chapters.at(-1)?.sort_no ?? 0))
  }

  return (
    <div style={{ borderTop: '1px solid rgba(197,179,130,.25)', marginTop: 14, paddingTop: 14 }}>
      <div className="arow" style={{ borderBottom: 'none', cursor: 'pointer' }} onClick={onToggle}>
        <div className="grow">
          <b>{course.title}</b>
          <span className="sub">{AUDIENCE_LABEL[course.audience]}・{chapters.length} 章{course.is_active ? '' : '・已下架'}</span>
        </div>
        <span className="muted">{open ? '收合 ▲' : '編輯 ▼'}</span>
      </div>

      {open && (
        <div style={{ paddingLeft: 6 }}>
          <div className="inline-form">
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

          {chapters.map(ch => (
            <ChapterEditor key={ch.key} chapter={ch}
              materials={materials.filter(m => m.chapter_key === ch.key).sort((a, b) => a.sort_no - b.sort_no)}
              content={content} />
          ))}
          <p style={{ marginTop: 12 }}>
            <button className="btn-line" onClick={() => void addChapter()}>＋加一章</button>
          </p>
        </div>
      )}
    </div>
  )
}

function ChapterEditor({ chapter, materials, content }: {
  chapter: Chapter
  materials: Material[]
  content: AdminContent
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

  async function addSection() {
    const { data, error } = await supabase.from('course_sections').insert({
      chapter_key: chapter.key, heading: '新小節',
      sort_no: (sections.at(-1)?.sort_no ?? 0) + 10,
    }).select().single()
    if (error) { setErr(error.message); return }
    setSections(ss => [...ss, data as Section])
  }

  return (
    <div style={{ marginTop: 10, marginLeft: 10, paddingLeft: 14, borderLeft: '2px solid rgba(197,179,130,.4)' }}>
      <div className="arow" style={{ borderBottom: 'none', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div className="grow">
          <b style={{ fontSize: 13.5 }}>{chapter.title}</b>
          <span className="sub">{materials.length} 份教材{chapter.is_active ? '' : '・已停用'}</span>
        </div>
        <span className="muted" style={{ fontSize: 12 }}>{open ? '收合 ▲' : '展開 ▼'}</span>
      </div>
      {open && (
        <div>
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
          {materials.map(m => (
            <MaterialAdminRow key={m.id} material={m} onToggle={() => content.toggleMaterial(m)} />
          ))}

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

function MaterialAdminRow({ material, onToggle }: { material: Material; onToggle: () => Promise<string | null> }) {
  const [busy, setBusy] = useState(false)
  async function toggle() {
    setBusy(true)
    await onToggle()
    setBusy(false)
  }
  return (
    <div className="arow">
      <div className="grow">
        <b className="i" style={{ fontSize: 13 }}>{material.kind === 'video' ? <IconFilm size={14} /> : <IconFileText size={14} />}{material.label}</b>
        {!material.is_active && <span className="sub">已停用——學員看不到</span>}
      </div>
      <button className="btn-line" disabled={busy} onClick={() => void toggle()}>
        {material.is_active ? '停用' : '啟用'}
      </button>
    </div>
  )
}
