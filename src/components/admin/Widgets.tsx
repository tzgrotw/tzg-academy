import { useEffect, type ReactNode } from 'react'
import { IconX } from '../icons'
import type { BookingStatus, OrderStatus } from '../../lib/types'

/** 數字卡——各後台頁頂部的即時總覽 */
export function StatCard({ label, value, sub, accent }: {
  label: string
  value: ReactNode
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`stat-card${accent ? ' accent' : ''}`}>
      <span className="lb">{label}</span>
      <b>{value}</b>
      {sub && <span className="sub2">{sub}</span>}
    </div>
  )
}

/** 側滑抽屜——新增/編輯表單不整頁跳走；Esc 或點遮罩關閉 */
export function Drawer({ title, onClose, children, footer }: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="drawer-veil" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dhd">
          <b>{title}</b>
          <button className="icon-btn" onClick={onClose} aria-label="關閉"><IconX size={17} /></button>
        </div>
        <div className="dbd">{children}</div>
        {footer && <div className="dft">{footer}</div>}
      </aside>
    </>
  )
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待付款', paid: '已付款', refunded: '已退款', cancelled: '已取消',
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: '待確認', confirmed: '已確認', completed: '已完成', cancelled: '已取消', no_show: '未到',
}

/** 訂單/預約狀態章——色票在 styles.css 的 .statuschip.* */
export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={`statuschip ${status}`}>{label}</span>
}
