import { useMemo, useState } from 'react'
import { useAdminInstructors } from '../../hooks/useAdminInstructors'
import { useConfirm } from '../../components/ConfirmDialog'
import { useToast } from '../../components/admin/Toast'
import { CatalogError } from '../../components/CatalogError'
import { IconTrash, IconX } from '../../components/icons'
import type { Service } from '../../lib/types'

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' })

/** 服務與時段——「線上看完課 → 線下買服務」的供給端：
 *  每位講師掛幾個服務（做臉、諮詢、課程體驗…），每個服務排可預約時段。 */
export function ServicesPage() {
  const inst = useAdminInstructors()
  const [instructorId, setInstructorId] = useState<number | null>(null)

  if (inst.loaded && inst.error) return <CatalogError message={inst.error} retry={inst.reload} />

  const active = inst.instructors.filter(i => i.is_active)
  const current = active.find(i => i.id === (instructorId ?? active[0]?.id)) ?? null
  const services = current ? inst.services.filter(s => s.instructor_id === current.id) : []

  return (
    <>
      <div className="page-hd">
        <h2>服務與時段</h2>
        <span className="sub">學員看完課之後約的線下服務。時段是平台代講師登記的——跟講師對好行事曆再排進來。</span>
      </div>

      {inst.loaded && active.length === 0 && (
        <div className="adm-empty" style={{ marginTop: 20 }}>先到「講師管理」建講師，回來這裡幫她排服務。</div>
      )}

      {active.length > 0 && (
        <div className="adm-toolbar">
          <select value={current?.id ?? ''} onChange={e => setInstructorId(Number(e.target.value))} aria-label="選講師">
            {active.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          {current && <AddServiceInline instructorId={current.id} inst={inst} />}
        </div>
      )}

      {current && services.length === 0 && inst.loaded && (
        <div className="adm-empty" style={{ marginTop: 16 }}>{current.name} 還沒有服務——用上面的欄位加第一個。</div>
      )}

      {services.map(s => <ServiceCard key={s.id} service={s} inst={inst} />)}
    </>
  )
}

function AddServiceInline({ instructorId, inst }: {
  instructorId: number
  inst: ReturnType<typeof useAdminInstructors>
}) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    setBusy(true)
    const err = await inst.createService(instructorId, title)
    setBusy(false)
    if (err) { toast(err, 'err'); return }
    setTitle('')
    toast('服務加好了——展開卡片補時長、價格與時段')
  }

  return (
    <>
      <input type="text" value={title} onChange={e => setTitle(e.target.value)}
        placeholder="新服務名稱（例：一對一芳療諮詢）"
        onKeyDown={e => { if (e.key === 'Enter' && title.trim()) void add() }} />
      <button className="btn btn-s" disabled={busy || !title.trim()} onClick={() => void add()}>＋ 加服務</button>
    </>
  )
}

function ServiceCard({ service, inst }: {
  service: Service
  inst: ReturnType<typeof useAdminInstructors>
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [form, setForm] = useState({
    title: service.title, description: service.description, duration_min: service.duration_min,
    price_twd: service.price_twd, location_note: service.location_note,
  })
  const dirty = form.title !== service.title || form.description !== service.description
    || form.duration_min !== service.duration_min || form.price_twd !== service.price_twd
    || form.location_note !== service.location_note

  const slots = useMemo(() => inst.slots
    .filter(sl => sl.service_id === service.id && new Date(sl.ends_at) > new Date()), [inst.slots, service.id])
  const byDay = useMemo(() => {
    const map = new Map<string, typeof slots>()
    for (const sl of slots) {
      const day = sl.starts_at.slice(0, 10)
      map.set(day, [...(map.get(day) ?? []), sl])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [slots])

  const save = async () => {
    const err = await inst.updateService(service.id, {
      ...form,
      duration_min: Math.max(5, Math.round(form.duration_min)),
      price_twd: Math.max(0, Math.round(form.price_twd)),
    })
    toast(err ?? '已儲存', err ? 'err' : 'ok')
  }

  return (
    <div className="acard">
      <div className="arow" style={{ borderBottom: 'none', paddingTop: 0 }}>
        <div className="grow"><h3>{service.title}{service.is_active ? '' : '（下架中）'}</h3></div>
        <label className="i muted" style={{ fontSize: 12.5, cursor: 'pointer', gap: 6 }}>
          <input type="checkbox" checked={service.is_active}
            onChange={async e => {
              const err = await inst.updateService(service.id, { is_active: e.target.checked })
              if (err) toast(err, 'err')
            }} />
          上架
        </label>
        <button className="icon-btn danger" aria-label="刪除服務" onClick={async () => {
          if (!await confirm(`刪除服務「${service.title}」？它的未來時段會一起下架。`, { danger: true })) return
          const err = await inst.deleteService(service.id)
          toast(err ?? '服務已刪除', err ? 'err' : 'ok')
        }}><IconTrash size={15} /></button>
      </div>

      <div className="inline-form">
        <input style={{ flex: 2, minWidth: 180 }} value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="服務名稱" />
        <input type="number" min={5} step={5} style={{ width: 90 }} value={form.duration_min}
          onChange={e => setForm(f => ({ ...f, duration_min: Number(e.target.value) }))} aria-label="時長（分鐘）" />
        <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>分鐘</span>
        <input type="number" min={0} step={100} style={{ width: 110 }} value={form.price_twd}
          onChange={e => setForm(f => ({ ...f, price_twd: Number(e.target.value) }))} aria-label="價格" />
        <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>元（線下收）</span>
        <input style={{ flex: 2, minWidth: 160 }} value={form.location_note}
          onChange={e => setForm(f => ({ ...f, location_note: e.target.value }))} placeholder="地點（例：台北大安工作室）" />
        {dirty && <button className="btn btn-s" onClick={() => void save()}>存</button>}
      </div>

      <div className="curr-section-hd" style={{ marginTop: 18 }}>
        <h4>可預約時段（只列未來的）</h4>
      </div>
      <AddSlotInline service={service} inst={inst} />
      {byDay.length === 0 && <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>還沒排時段——上面選日期時間加進來。</p>}
      {byDay.map(([day, list]) => (
        <div className="slot-day" key={day}>
          <span className="cap">{fmtDate(day + 'T00:00:00')}</span>
          <div>
            {list.map(sl => (
              <span className="slot-pill" key={sl.id}>
                {fmtTime(sl.starts_at)}–{fmtTime(sl.ends_at)}
                {sl.capacity > 1 && <span className="muted">×{sl.capacity}</span>}
                <button className="icon-btn" aria-label="刪除時段" onClick={async () => {
                  const err = await inst.deleteSlot(sl.id)
                  if (err) toast(err, 'err')
                }}><IconX size={13} /></button>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function AddSlotInline({ service, inst }: {
  service: Service
  inst: ReturnType<typeof useAdminInstructors>
}) {
  const toast = useToast()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('14:00')
  const [capacity, setCapacity] = useState(1)
  const [repeatWeeks, setRepeatWeeks] = useState(1)
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (!date) { toast('先選日期', 'err'); return }
    setBusy(true)
    const rows = Array.from({ length: Math.max(1, repeatWeeks) }, (_, w) => {
      const start = new Date(`${date}T${time}:00`)
      start.setDate(start.getDate() + w * 7)
      const end = new Date(start.getTime() + service.duration_min * 60_000)
      return {
        service_id: service.id, starts_at: start.toISOString(), ends_at: end.toISOString(),
        capacity: Math.max(1, Math.round(capacity)),
      }
    })
    const err = await inst.addSlots(rows)
    setBusy(false)
    toast(err ?? (rows.length > 1 ? `一次排好 ${rows.length} 週的同一時段` : '時段加好了'), err ? 'err' : 'ok')
  }

  return (
    <div className="inline-form" style={{ marginTop: 4 }}>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="日期" />
      <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label="開始時間" />
      <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>共 {service.duration_min} 分鐘・可約</span>
      <input type="number" min={1} style={{ width: 64 }} value={capacity}
        onChange={e => setCapacity(Number(e.target.value))} aria-label="人數" />
      <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>人・連排</span>
      <select value={repeatWeeks} onChange={e => setRepeatWeeks(Number(e.target.value))} aria-label="連續幾週">
        {[1, 2, 3, 4, 6, 8].map(n => <option key={n} value={n}>{n} 週</option>)}
      </select>
      <button className="btn btn-s" disabled={busy || !date} onClick={() => void add()}>＋ 加時段</button>
    </div>
  )
}
