import { useMemo, useState } from 'react'
import { useAdminOrders } from '../../hooks/useAdminOrders'
import { useAdminInstructors } from '../../hooks/useAdminInstructors'
import { useAdminMembers } from '../../hooks/useAdminMembers'
import { useCatalog } from '../../hooks/useCatalog'
import { useConfirm } from '../../components/ConfirmDialog'
import { useToast } from '../../components/admin/Toast'
import { DataTable, type Column } from '../../components/admin/DataTable'
import { Drawer, ORDER_STATUS_LABEL, StatCard, StatusBadge } from '../../components/admin/Widgets'
import { CatalogError } from '../../components/CatalogError'
import { currentPrice } from '../../lib/tier'
import type { Order, OrderStatus } from '../../lib/types'

const NT = (n: number) => `NT$ ${n.toLocaleString()}`
const monthOf = (iso: string | null) => (iso ?? '').slice(0, 7)

/** 訂單——本階段人工收款：建單（待付款）→ 對完帳「標記已付」，課程立刻解鎖。
 *  之後綠界上線，線上付款的單自動變已付，這頁照樣管全部。 */
export function OrdersPage() {
  const ord = useAdminOrders()
  const inst = useAdminInstructors()
  const members = useAdminMembers()
  const cat = useCatalog()
  const confirm = useConfirm()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')
  const [monthFilter, setMonthFilter] = useState('all')

  const memberOf = (userId: string) => members.rows.find(m => m.user_id === userId)
  const courseOf = (id: number) => cat.courses.find(c => c.id === id)
  const instructorOf = (id: number | null) => inst.instructors.find(i => i.id === id)

  const months = useMemo(() => {
    const set = new Set(ord.orders.map(o => monthOf(o.created_at)).filter(Boolean))
    return [...set].sort().reverse()
  }, [ord.orders])

  if (ord.loaded && ord.error) return <CatalogError message={ord.error} retry={ord.reload} />

  const shown = ord.orders
    .filter(o => statusFilter === 'all' || o.status === statusFilter)
    .filter(o => monthFilter === 'all' || monthOf(o.created_at) === monthFilter)

  const thisMonth = monthOf(new Date().toISOString())
  const paidThisMonth = ord.orders.filter(o => o.status === 'paid' && monthOf(o.paid_at) === thisMonth)
  const revenue = paidThisMonth.reduce((s, o) => s + o.amount_twd, 0)
  const platformCut = paidThisMonth.reduce((s, o) => s + o.platform_amount_twd, 0)
  const pendingCount = ord.orders.filter(o => o.status === 'pending').length

  const setStatus = async (o: Order, status: OrderStatus, message: string) => {
    if (!await confirm(message, { danger: status !== 'paid' })) return
    const err = await ord.setStatus(o.id, status)
    toast(err ?? `訂單 #${o.id} → ${ORDER_STATUS_LABEL[status]}`, err ? 'err' : 'ok')
  }

  const columns: Column<Order>[] = [
    { key: 'id', title: '#', render: o => o.id, sort: (a, b) => a.id - b.id },
    {
      key: 'member', title: '會員', render: o => {
        const m = memberOf(o.user_id)
        return m ? (m.name || m.email) : o.user_id.slice(0, 8)
      },
    },
    { key: 'course', title: '課程', render: o => courseOf(o.course_id)?.title ?? `#${o.course_id}` },
    { key: 'amount', title: '金額', num: true, render: o => NT(o.amount_twd), sort: (a, b) => a.amount_twd - b.amount_twd },
    {
      key: 'split', title: '拆帳（講師/推薦/平台）', num: true, render: o => (
        <span className="muted" style={{ fontSize: 12.5 }}>
          {instructorOf(o.instructor_id)?.name ?? '—'} {NT(o.instructor_amount_twd)}
          {o.referrer_instructor_id != null && ` ／ ${instructorOf(o.referrer_instructor_id)?.name ?? '推薦'} ${NT(o.referrer_amount_twd)}`}
          ／ {NT(o.platform_amount_twd)}
        </span>
      ),
    },
    {
      key: 'status', title: '狀態', render: o => <StatusBadge status={o.status} label={ORDER_STATUS_LABEL[o.status]} />,
      sort: (a, b) => a.status.localeCompare(b.status),
    },
    {
      key: 'date', title: '日期', render: o => o.created_at.slice(0, 10),
      sort: (a, b) => a.created_at.localeCompare(b.created_at),
    },
    {
      key: 'actions', title: '', render: o => (
        <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {o.status === 'pending' && (
            <>
              <button className="btn btn-s" onClick={e => {
                e.stopPropagation()
                void setStatus(o, 'paid', `確認收到這筆 ${NT(o.amount_twd)}？標記已付後，會員立刻能看這門課。`)
              }}>標記已付</button>
              <button className="btn-line" onClick={e => {
                e.stopPropagation()
                void setStatus(o, 'cancelled', '取消這筆訂單？')
              }}>取消</button>
            </>
          )}
          {o.status === 'paid' && (
            <button className="btn-line" onClick={e => {
              e.stopPropagation()
              void setStatus(o, 'refunded', '標記退款？會員會立刻失去這門課的觀看權限。')
            }}>退款</button>
          )}
        </span>
      ),
    },
  ]

  return (
    <>
      <div className="page-hd">
        <h2>訂單</h2>
        <div className="right">
          <button className="btn btn-s" onClick={() => setCreating(true)}>＋ 手動建單</button>
        </div>
        <span className="sub">會員轉帳／LINE Pay 對完帳後，在這裡按「標記已付」開通課程；退款按下去權限自動收回。</span>
      </div>

      <div className="adm-stats">
        <StatCard label="本月營收（已付）" value={NT(revenue)} accent sub={`${paidThisMonth.length} 筆`} />
        <StatCard label="本月平台份額" value={NT(platformCut)} />
        <StatCard label="待付款" value={pendingCount} sub="對到帳就標記已付" />
      </div>

      <DataTable rows={shown} columns={columns} rowKey={o => o.id} empty="還沒有訂單——按右上角手動建第一筆。"
        searchText={o => {
          const m = memberOf(o.user_id)
          return `${o.id} ${m?.name ?? ''} ${m?.email ?? ''} ${courseOf(o.course_id)?.title ?? ''}`
        }}
        searchPlaceholder="搜會員、課程、訂單編號…"
        filters={
          <>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | OrderStatus)} aria-label="狀態篩選">
              <option value="all">全部狀態</option>
              {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map(s =>
                <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
            </select>
            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} aria-label="月份篩選">
              <option value="all">全部月份</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </>
        } />

      {creating && <CreateOrderDrawer onClose={() => setCreating(false)} ord={ord} inst={inst} members={members} cat={cat} />}
    </>
  )
}

function CreateOrderDrawer({ onClose, ord, inst, members, cat }: {
  onClose: () => void
  ord: ReturnType<typeof useAdminOrders>
  inst: ReturnType<typeof useAdminInstructors>
  members: ReturnType<typeof useAdminMembers>
  cat: ReturnType<typeof useCatalog>
}) {
  const toast = useToast()
  const [memberQ, setMemberQ] = useState('')
  const [userId, setUserId] = useState('')
  const [courseId, setCourseId] = useState<number | ''>('')
  const [amount, setAmount] = useState<number | ''>('')
  const [refCode, setRefCode] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const matches = memberQ.trim()
    ? members.rows.filter(m =>
        m.email.toLowerCase().includes(memberQ.trim().toLowerCase())
        || m.name.toLowerCase().includes(memberQ.trim().toLowerCase())).slice(0, 6)
    : []
  const member = members.rows.find(m => m.user_id === userId) ?? null
  const course = cat.courses.find(c => c.id === courseId) ?? null
  const instructor = course ? inst.instructors.find(i => i.id === course.instructor_id) ?? null : null
  const referrer = refCode.trim()
    ? inst.instructors.find(i => i.referral_code === refCode.trim().toLowerCase()) ?? null
    : null
  const finalAmount = amount === '' ? (course ? currentPrice(course) : 0) : amount

  const save = async () => {
    if (!member) { setErr('先選會員'); return }
    if (!course) { setErr('先選課程'); return }
    if (refCode.trim() && !referrer) { setErr(`找不到推薦碼「${refCode.trim()}」的講師`); return }
    setBusy(true)
    const e = await ord.createOrder({
      userId: member.user_id, courseId: course.id, amountTwd: Math.max(0, Math.round(Number(finalAmount))),
      instructor, referrer, note,
    })
    setBusy(false)
    if (e) { setErr(e); return }
    toast('訂單建好了（待付款）——對到帳再標記已付')
    onClose()
  }

  return (
    <Drawer title="手動建單" onClose={onClose} footer={
      <>
        {err && <p className="formerr">{err}</p>}
        <button className="btn-line" onClick={onClose}>取消</button>
        <button className="btn btn-s" disabled={busy} onClick={() => void save()}>建立訂單</button>
      </>
    }>
      <div className="field">
        <label>會員（搜 email 或名字）</label>
        {member
          ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input readOnly value={`${member.name || '（未填名字）'}・${member.email}`} />
              <button className="btn-line" onClick={() => { setUserId(''); setMemberQ('') }}>換人</button>
            </div>
          )
          : (
            <>
              <input value={memberQ} onChange={e => setMemberQ(e.target.value)} placeholder="輸入至少一個字開始搜" />
              {matches.map(m => (
                <button key={m.user_id} className="vrow" style={{ marginTop: 6 }} onClick={() => setUserId(m.user_id)}>
                  <span style={{ minWidth: 0, flex: 1 }}><b>{m.name || '（未填名字）'}</b>
                    <span className="sub">{m.email}</span></span>
                </button>
              ))}
            </>
          )}
      </div>
      <div className="field">
        <label>課程</label>
        <select value={courseId} onChange={e => setCourseId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">選一門課</option>
          {cat.courses.filter(c => c.is_active).map(c => (
            <option key={c.id} value={c.id}>
              {c.title}{c.price_twd > 0 ? `（${currentPrice(c).toLocaleString()} 元）` : '（免費課）'}
            </option>
          ))}
        </select>
        {course && course.price_twd === 0 && (
          <p className="formerr" style={{ marginTop: 8 }}>這門是免費課——不用建單也看得到。確定要收費請先到課程設定裡定價。</p>
        )}
        {instructor && <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>講師：{instructor.name}（分潤 {instructor.revenue_share_pct}%）</p>}
      </div>
      <div className="field">
        <label>金額（空白＝目前售價 {course ? currentPrice(course).toLocaleString() : '—'} 元）</label>
        <input type="number" min={0} value={amount}
          onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="自訂成交價" />
      </div>
      <div className="field">
        <label>推薦碼（選填——哪位講師導流來的就填她的代號）</label>
        <input value={refCode} onChange={e => setRefCode(e.target.value)} placeholder="例：amy-yoga" />
        {referrer && <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>推薦人：{referrer.name}（抽 {referrer.referral_cut_pct}%，從講師份額出）</p>}
      </div>
      <div className="field">
        <label>備註（選填）</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="例：8/19 轉帳末五碼 12345" />
      </div>
    </Drawer>
  )
}
