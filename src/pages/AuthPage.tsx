import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Page } from '../components/Shell'
import { supabase } from '../lib/supabase'

// 註冊／登入——一頁一件事，欄位越少越好（名字＋Email＋密碼）。
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null); setOk(null)
    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email, password: pw, options: { data: { name } },
        })
        if (error) throw error
        if (data.session) { navigate('/courses'); return }
        setOk('註冊成功！去信箱點一下確認信，就可以登入上課了。')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
        if (error) throw error
        navigate('/courses')
      }
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2)
      setErr(/invalid login/i.test(msg) ? 'Email 或密碼不對——再試一次'
        : /already registered/i.test(msg) ? '這個 Email 已經註冊過了——直接登入就好'
        : /at least 6/i.test(msg) ? '密碼至少要 6 個字'
        : msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <div className="authbox">
        <h1 className="serif">{mode === 'register' ? '免費加入學院' : '歡迎回來'}</h1>
        <p className="hint">{mode === 'register'
          ? '註冊就能看公開課、自動記進度；進階課入會解鎖。'
          : '登入接著上次的進度繼續上課。'}</p>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="name">怎麼稱呼妳</label>
              <input id="name" value={name} onChange={e => setName(e.target.value)} required maxLength={40} placeholder="例：小婷" autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
          </div>
          <div className="field">
            <label htmlFor="pw">密碼</label>
            <input id="pw" type="password" value={pw} onChange={e => setPw(e.target.value)} required minLength={6}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="至少 6 個字" />
          </div>
          {err && <p className="formerr">{err}</p>}
          {ok && <p className="formok">{ok}</p>}
          <button className="btn btn-m" type="submit" disabled={busy}>
            {busy ? '處理中…' : mode === 'register' ? '建立帳號' : '登入'}
          </button>
        </form>
        <p className="swap">
          {mode === 'register'
            ? <>已經有帳號了？<Link to="/login" style={{ color: 'var(--magenta)', fontWeight: 700 }}>直接登入</Link></>
            : <>還沒有帳號？<Link to="/register" style={{ color: 'var(--magenta)', fontWeight: 700 }}>免費註冊</Link></>}
        </p>
      </div>
    </Page>
  )
}
