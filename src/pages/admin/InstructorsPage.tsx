import { useRef, useState } from 'react'
import { useAdminInstructors } from '../../hooks/useAdminInstructors'
import { useAdminOrders } from '../../hooks/useAdminOrders'
import { useCatalog } from '../../hooks/useCatalog'
import { useConfirm } from '../../components/ConfirmDialog'
import { useToast } from '../../components/admin/Toast'
import { Drawer, StatCard } from '../../components/admin/Widgets'
import { CatalogError } from '../../components/CatalogError'
import type { Instructor, Order } from '../../lib/types'

/** 本月（自然月）paid 訂單裡，這位講師該拿的錢：自己課的份額＋當推薦人的獎金 */
function monthlyPayout(orders: Order[], instructorId: number): number {
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return orders
    .filter(o => o.status === 'paid' && (o.paid_at ?? '').startsWith(monthKey))
    .reduce((sum, o) => sum
      + (o.instructor_id === instructorId ? o.instructor_amount_twd : 0)
      + (o.referrer_instructor_id === instructorId ? o.referrer_amount_twd : 0), 0)
}

export function InstructorsPage() {
  const inst = useAdminInstructors()
  const { orders } = useAdminOrders()
  const cat = useCatalog()
  const confirm = useConfirm()
  const toast = useToast()
  const [editing, setEditing] = useState<Instructor | null>(null)
  const [adding, setAdding] = useState(false)

  if (inst.loaded && inst.error) return <CatalogError message={inst.error} retry={inst.reload} />

  const courseCount = (id: number) => cat.courses.filter(c => c.instructor_id === id).length
  const monthTotal = inst.instructors.reduce((s, i) => s + monthlyPayout(orders, i.id), 0)

  return (
    <>
      <div className="page-hd">
        <h2>講師管理</h2>
        <div className="right">
          <button className="btn btn-s" onClick={() => setAdding(true)}>＋ 新增講師</button>
        </div>
        <span className="sub">平台代管講師的課程與服務；分潤比例在各講師卡片裡設定，推薦連結也從這裡複製。</span>
      </div>

      <div className="adm-stats">
        <StatCard label="講師人數" value={inst.instructors.filter(i => i.is_active).length}
          sub={`含停用共 ${inst.instructors.length} 位`} />
        <StatCard label="本月應付分潤（已付訂單）" value={`NT$ ${monthTotal.toLocaleString()}`} accent />
      </div>

      {!inst.loaded && <div className="skel" />}
      {inst.loaded && inst.instructors.length === 0 && (
        <div className="adm-empty" style={{ marginTop: 20 }}>
          還沒有講師——點右上角「＋ 新增講師」建第一位。<br />建好之後到「課程」把課掛到她名下。
        </div>
      )}

      <div className="inst-grid">
        {inst.instructors.map(i => (
          <button key={i.id} className={`inst-card${i.is_active ? '' : ' off'}`} onClick={() => setEditing(i)}>
            <span className="top">
              {i.avatar_url
                ? <img className="ava" src={i.avatar_url} alt="" />
                : <span className="ava">{i.name.slice(0, 1)}</span>}
              <span style={{ minWidth: 0 }}>
                <b className="nm">{i.name}{i.is_active ? '' : '（停用）'}</b>
                <span className="hl">{i.headline || `@${i.slug}`}</span>
              </span>
            </span>
            <span className="row2">
              <span><b>{courseCount(i.id)}</b> 門課</span>
              <span>本月分潤 <b>NT$ {monthlyPayout(orders, i.id).toLocaleString()}</b></span>
            </span>
          </button>
        ))}
      </div>

      {adding && <AddInstructorDrawer onClose={() => setAdding(false)} inst={inst} />}
      {editing && (
        <EditInstructorDrawer key={editing.id} instructor={editing}
          onClose={() => setEditing(null)} inst={inst}
          onDelete={async () => {
            if (!await confirm(`確定把講師「${editing.name}」移到垃圾桶？她名下的課程會變成未指派講師。`)) return
            const err = await inst.deleteInstructor(editing.id)
            if (err) { toast(err, 'err'); return }
            toast('已移除講師')
            setEditing(null)
          }} />
      )}
    </>
  )
}

function AddInstructorDrawer({ onClose, inst }: {
  onClose: () => void
  inst: ReturnType<typeof useAdminInstructors>
}) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const e = await inst.createInstructor(name, slug)
    setBusy(false)
    if (e) { setErr(e); return }
    toast('講師建好了——點卡片補頭像和分潤設定')
    onClose()
  }

  return (
    <Drawer title="新增講師" onClose={onClose} footer={
      <>
        {err && <p className="formerr">{err}</p>}
        <button className="btn-line" onClick={onClose}>取消</button>
        <button className="btn btn-s" disabled={busy || !name.trim() || !slug.trim()} onClick={() => void save()}>建立</button>
      </>
    }>
      <div className="field">
        <label>講師名字</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="例：Amy 老師" />
      </div>
      <div className="field">
        <label>網址代號（小寫英文，之後是她的專屬連結）</label>
        <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="例：amy-yoga" />
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          這也是她的推薦碼——別人經 ?ref={slug.trim() || 'amy-yoga'} 買課，她抽推薦獎金。建立後不要隨便改。
        </p>
      </div>
    </Drawer>
  )
}

function EditInstructorDrawer({ instructor, onClose, inst, onDelete }: {
  instructor: Instructor
  onClose: () => void
  inst: ReturnType<typeof useAdminInstructors>
  onDelete: () => Promise<void>
}) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [form, setForm] = useState({
    name: instructor.name, headline: instructor.headline, bio: instructor.bio,
    line_url: instructor.line_url, ig_url: instructor.ig_url,
    revenue_share_pct: instructor.revenue_share_pct, referral_cut_pct: instructor.referral_cut_pct,
  })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refLink = `${window.location.origin}/courses?ref=${instructor.referral_code}`

  const save = async () => {
    setBusy(true)
    const e = await inst.updateInstructor(instructor.id, {
      ...form,
      revenue_share_pct: Math.min(100, Math.max(0, Math.round(form.revenue_share_pct))),
      referral_cut_pct: Math.min(100, Math.max(0, Math.round(form.referral_cut_pct))),
    })
    setBusy(false)
    if (e) { setErr(e); return }
    toast('已儲存')
    onClose()
  }

  const uploadAvatar = async (file: File) => {
    setBusy(true)
    const e = await inst.uploadInstructorAvatar(instructor.id, file)
    setBusy(false)
    if (e) { toast(e, 'err'); return }
    toast('頭像換好了')
  }

  return (
    <Drawer title={`編輯講師：${instructor.name}`} onClose={onClose} footer={
      <>
        {err && <p className="formerr">{err}</p>}
        <button className="btn-danger btn" onClick={() => void onDelete()}>移到垃圾桶</button>
        <button className="btn btn-s" disabled={busy} onClick={() => void save()}>儲存</button>
      </>
    }>
      <div className="field" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {instructor.avatar_url
          ? <img src={instructor.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
          : <span className="ava" style={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--gold-pale)', color: 'var(--gold-deep)', fontWeight: 800, fontSize: 20 }}>{instructor.name.slice(0, 1)}</span>}
        <div>
          <button className="btn-line" disabled={busy} onClick={() => fileRef.current?.click()}>換頭像</button>
          <input ref={fileRef} type="file" accept="image/*" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); e.target.value = '' }} />
        </div>
      </div>
      <div className="field"><label>名字</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
      <div className="field"><label>一句話介紹（列表卡片上顯示）</label>
        <input value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
          placeholder="例：芳療 × 女性創業教練" /></div>
      <div className="field"><label>完整介紹</label>
        <textarea className="note-ta" style={{ marginTop: 0 }} value={form.bio}
          onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} /></div>
      <div className="field"><label>LINE 連結</label>
        <input value={form.line_url} onChange={e => setForm(f => ({ ...f, line_url: e.target.value }))}
          placeholder="https://line.me/…" /></div>
      <div className="field"><label>Instagram 連結</label>
        <input value={form.ig_url} onChange={e => setForm(f => ({ ...f, ig_url: e.target.value }))}
          placeholder="https://instagram.com/…" /></div>

      <div className="field" style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label>講師分潤 %（直接成交拿這個比例）</label>
          <input type="number" min={0} max={100} value={form.revenue_share_pct}
            onChange={e => setForm(f => ({ ...f, revenue_share_pct: Number(e.target.value) }))} />
        </div>
        <div style={{ flex: 1 }}>
          <label>推薦抽成 %（從講師份額出）</label>
          <input type="number" min={0} max={100} value={form.referral_cut_pct}
            onChange={e => setForm(f => ({ ...f, referral_cut_pct: Number(e.target.value) }))} />
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
        目前規則：直接成交 講師 {form.revenue_share_pct}%／平台 {100 - form.revenue_share_pct}%；
        經推薦成交 講師 {Math.max(0, form.revenue_share_pct - form.referral_cut_pct)}%／推薦人 {form.referral_cut_pct}%／平台 {100 - form.revenue_share_pct}%。
      </p>

      <div className="field">
        <label>推薦連結（發給她轉貼）</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input readOnly value={refLink} onFocus={e => e.target.select()} />
          <button className="btn-line" onClick={() => {
            void navigator.clipboard.writeText(refLink)
            toast('已複製推薦連結')
          }}>複製</button>
        </div>
      </div>

      <div className="field">
        <label className="i" style={{ display: 'flex', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={instructor.is_active}
            onChange={async e => {
              const err2 = await inst.updateInstructor(instructor.id, { is_active: e.target.checked })
              if (err2) toast(err2, 'err')
            }} />
          上架中（取消勾選＝前台看不到她）
        </label>
      </div>
    </Drawer>
  )
}
