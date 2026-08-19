import { useState } from 'react'
import { useAdminBookings } from '../../hooks/useAdminBookings'
import { useAdminInstructors } from '../../hooks/useAdminInstructors'
import { useAdminMembers } from '../../hooks/useAdminMembers'
import { useCatalog } from '../../hooks/useCatalog'
import { useToast } from '../../components/admin/Toast'
import { DataTable, type Column } from '../../components/admin/DataTable'
import { BOOKING_STATUS_LABEL, StatCard, StatusBadge } from '../../components/admin/Widgets'
import { CatalogError } from '../../components/CatalogError'
import type { Booking, BookingStatus } from '../../lib/types'

const fmt = (iso: string) => new Date(iso).toLocaleString('zh-TW', {
  month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
})

/** 預約——「看完課 → 約線下服務」的成交現場。
 *  狀態流：待確認 → 已確認 → 已完成（服務做完）；取消／未到也記著，講師談分潤有依據。 */
export function BookingsPage() {
  const bk = useAdminBookings()
  const inst = useAdminInstructors()
  const members = useAdminMembers()
  const cat = useCatalog()
  const toast = useToast()
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all')

  if (bk.loaded && bk.error) return <CatalogError message={bk.error} retry={bk.reload} />

  const slotOf = (id: number) => inst.slots.find(s => s.id === id)
  const serviceOf = (b: Booking) => {
    const slot = slotOf(b.slot_id)
    return slot ? inst.services.find(s => s.id === slot.service_id) : undefined
  }
  const instructorOf = (b: Booking) => {
    const svc = serviceOf(b)
    return svc ? inst.instructors.find(i => i.id === svc.instructor_id) : undefined
  }
  const memberOf = (userId: string) => members.rows.find(m => m.user_id === userId)

  const shown = bk.bookings.filter(b => statusFilter === 'all' || b.status === statusFilter)
  const pending = bk.bookings.filter(b => b.status === 'pending').length
  const upcoming = bk.bookings.filter(b => {
    const slot = slotOf(b.slot_id)
    return b.status === 'confirmed' && slot && new Date(slot.starts_at) > new Date()
  }).length
  const fromCourses = bk.bookings.filter(b => b.source_course_id != null).length

  const move = async (b: Booking, status: BookingStatus) => {
    const err = await bk.setStatus(b.id, status)
    toast(err ?? `預約 #${b.id} → ${BOOKING_STATUS_LABEL[status]}`, err ? 'err' : 'ok')
  }

  const columns: Column<Booking>[] = [
    {
      key: 'time', title: '時間', render: b => {
        const slot = slotOf(b.slot_id)
        return slot ? fmt(slot.starts_at) : `時段 #${b.slot_id}`
      },
      sort: (a, b2) => (slotOf(a.slot_id)?.starts_at ?? '').localeCompare(slotOf(b2.slot_id)?.starts_at ?? ''),
    },
    {
      key: 'member', title: '會員', render: b => {
        const m = memberOf(b.user_id)
        return m ? (m.name || m.email) : b.user_id.slice(0, 8)
      },
    },
    { key: 'what', title: '講師／服務', render: b => `${instructorOf(b)?.name ?? '—'}・${serviceOf(b)?.title ?? '—'}` },
    {
      key: 'source', title: '來源課程', render: b => b.source_course_id
        ? (cat.courses.find(c => c.id === b.source_course_id)?.title ?? `#${b.source_course_id}`)
        : <span className="muted">—</span>,
    },
    { key: 'note', title: '備註', render: b => b.note ? b.note : <span className="muted">—</span> },
    {
      key: 'status', title: '狀態', render: b => <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />,
      sort: (a, b2) => a.status.localeCompare(b2.status),
    },
    {
      key: 'actions', title: '', render: b => (
        <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {b.status === 'pending' && (
            <>
              <button className="btn btn-s" onClick={() => void move(b, 'confirmed')}>確認</button>
              <button className="btn-line" onClick={() => void move(b, 'cancelled')}>取消</button>
            </>
          )}
          {b.status === 'confirmed' && (
            <>
              <button className="btn btn-s" onClick={() => void move(b, 'completed')}>完成</button>
              <button className="btn-line" onClick={() => void move(b, 'no_show')}>未到</button>
              <button className="btn-line" onClick={() => void move(b, 'cancelled')}>取消</button>
            </>
          )}
        </span>
      ),
    },
  ]

  return (
    <>
      <div className="page-hd">
        <h2>預約</h2>
        <span className="sub">學員站內預約講師的線下服務。服務做完記得按「完成」——分潤報表跟導流成效都靠這個記錄。</span>
      </div>

      <div className="adm-stats">
        <StatCard label="待確認" value={pending} accent={pending > 0} sub="盡快回覆學員" />
        <StatCard label="已確認・未來場次" value={upcoming} />
        <StatCard label="從課程轉來的預約" value={fromCourses} sub="看完課→約服務的轉換" />
      </div>

      <DataTable rows={shown} columns={columns} rowKey={b => b.id}
        empty="還沒有預約。學員端預約流程上線後，這裡會看到每一筆。"
        searchText={b => {
          const m = memberOf(b.user_id)
          return `${m?.name ?? ''} ${m?.email ?? ''} ${serviceOf(b)?.title ?? ''} ${instructorOf(b)?.name ?? ''}`
        }}
        searchPlaceholder="搜會員、講師、服務…"
        filters={
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | BookingStatus)} aria-label="狀態篩選">
            <option value="all">全部狀態</option>
            {(Object.keys(BOOKING_STATUS_LABEL) as BookingStatus[]).map(s =>
              <option key={s} value={s}>{BOOKING_STATUS_LABEL[s]}</option>)}
          </select>
        } />
    </>
  )
}
