import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'

export function Nav() {
  const { userId, profile, signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <nav className="nav"><div className="wrap in">
      <Link to="/" className="logo serif"><b>泰熙爾札娜學院</b><span>TZG ACADEMY</span></Link>
      <div className="links">
        <Link to="/courses">全部課程</Link>
        {userId && <Link to="/my">我的學習</Link>}
        {profile?.tier === 'admin' && <Link to="/admin">後台</Link>}
        {userId ? (
          <>
            <span className="muted" style={{ fontSize: 13 }}>{profile?.name || '同學'}</span>
            <button className="btn-line" onClick={() => { void signOut().then(() => navigate('/')) }}>登出</button>
          </>
        ) : (
          <>
            <Link to="/login">登入</Link>
            <Link to="/register" className="btn btn-s">免費註冊</Link>
          </>
        )}
      </div>
    </div></nav>
  )
}

export function Footer() {
  return (
    <div className="wrap foot">
      <span className="logo serif"><b style={{ fontSize: 14 }}>泰熙爾札娜學院</b><span>TZG ACADEMY</span></span>
      <div className="ribbon" />
      <span className="muted" style={{ marginLeft: 'auto' }}>© 2026 泰熙爾札娜</span>
    </div>
  )
}

/** 每一頁都套：頂欄＋內容＋頁尾 */
export function Page({ children }: { children: ReactNode }) {
  return (<><Nav />{children}<Footer /></>)
}
