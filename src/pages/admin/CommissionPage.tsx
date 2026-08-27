import { useMemo, useState } from 'react'
import { useAdminOrders } from '../../hooks/useAdminOrders'
import { useAdminInstructors } from '../../hooks/useAdminInstructors'
import { useToast } from '../../components/admin/Toast'
import { DataTable, type Column } from '../../components/admin/DataTable'
import { StatCard } from '../../components/admin/Widgets'
import { CatalogError } from '../../components/CatalogError'

const NT = (n: number) => `NT$ ${n.toLocaleString()}`

interface Row {
  instructorId: number
  name: string
  orderCount: number
  courseShare: number
  referralBonus: number
  total: number
}

/** 分潤報表——每月結算的依據：講師 × 月份，自己課的份額＋當推薦人的獎金。
 *  金額都是訂單「成立當下」存死的快照，改分潤比例不會動到舊帳。 */
export function CommissionPage() {
  const ord = useAdminOrders()
  const inst = useAdminInstructors()
  const toast = useToast()

  const months = useMemo(() => {
    const set = new Set(ord.orders.filter(o => o.status === 'paid' && o.paid_at).map(o => o.paid_at!.slice(0, 7)))
    const now = new Date().toISOString().slice(0, 7)
    set.add(now)
    return [...set].sort().reverse()
  }, [ord.orders])
  const [month, setMonth] = useState<string | null>(null)
  const current = month ?? months[0]

  if (ord.loaded && ord.error) return <CatalogError message={ord.error} retry={ord.reload} />

  const paid = ord.orders.filter(o => o.status === 'paid' && (o.paid_at ?? '').startsWith(current))

  const rows: Row[] = inst.instructors.map(i => {
    const own = paid.filter(o => o.instructor_id === i.id)
    const referred = paid.filter(o => o.referrer_instructor_id === i.id)
    const courseShare = own.reduce((s, o) => s + o.instructor_amount_twd, 0)
    const referralBonus = referred.reduce((s, o) => s + o.referrer_amount_twd, 0)
    return {
      instructorId: i.id, name: i.name, orderCount: own.length,
      courseShare, referralBonus, total: courseShare + referralBonus,
    }
  }).filter(r => r.total > 0 || r.orderCount > 0)

  const revenue = paid.reduce((s, o) => s + o.amount_twd, 0)
  const payoutTotal = rows.reduce((s, r) => s + r.total, 0)
  const platformTotal = paid.reduce((s, o) => s + o.platform_amount_twd, 0)

  const exportCsv = () => {
    const head = '講師,已付訂單數,課程分潤,推薦獎金,應付合計'
    const body = rows.map(r => `${r.name},${r.orderCount},${r.courseShare},${r.referralBonus},${r.total}`)
    // Excel 開 UTF-8 CSV 要 BOM，不然中文變亂碼
    const blob = new Blob(['﻿' + [head, ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `分潤-${current}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast('報表下載了——匯款完把明細發給講師')
  }

  const columns: Column<Row>[] = [
    { key: 'name', title: '講師', render: r => r.name },
    { key: 'orders', title: '已付訂單', num: true, render: r => r.orderCount, sort: (a, b) => a.orderCount - b.orderCount },
    { key: 'share', title: '課程分潤', num: true, render: r => NT(r.courseShare), sort: (a, b) => a.courseShare - b.courseShare },
    { key: 'ref', title: '推薦獎金', num: true, render: r => NT(r.referralBonus), sort: (a, b) => a.referralBonus - b.referralBonus },
    { key: 'total', title: '應付合計', num: true, render: r => <b>{NT(r.total)}</b>, sort: (a, b) => a.total - b.total },
  ]

  return (
    <>
      <div className="page-hd">
        <h2>分潤報表</h2>
        <div className="right">
          <select value={current} onChange={e => setMonth(e.target.value)} aria-label="月份"
            style={{ border: '1px solid var(--adm-line)', borderRadius: 10, padding: '9px 11px', font: 'inherit', fontSize: 13, background: 'var(--adm-card)' }}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button className="btn btn-s" onClick={exportCsv} disabled={rows.length === 0}>匯出 CSV</button>
        </div>
        <span className="sub">只算「已付」訂單，按付款日歸月。每月結算：照「應付合計」匯給各講師，平台份額留下。</span>
      </div>

      <div className="adm-stats">
        <StatCard label={`${current} 營收（已付）`} value={NT(revenue)} sub={`${paid.length} 筆`} />
        <StatCard label="應付講師合計" value={NT(payoutTotal)} />
        <StatCard label="平台份額" value={NT(platformTotal)} accent />
      </div>

      <DataTable rows={rows} columns={columns} rowKey={r => r.instructorId}
        empty={`${current} 還沒有已付訂單——訂單頁標記已付後，這裡就會有數字。`} />
    </>
  )
}
