import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastKind = 'ok' | 'err'
interface ToastItem { id: number; msg: string; kind: ToastKind }

const Ctx = createContext<(msg: string, kind?: ToastKind) => void>(() => {})

/** 存檔成功/失敗的短暫回饋——後台所有寫入動作共用，3 秒自動消失。
 *  用法：const toast = useToast(); toast('已儲存') / toast(err, 'err') */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const push = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const id = ++seq.current
    setItems(list => [...list, { id, msg, kind }])
    setTimeout(() => setItems(list => list.filter(t => t.id !== id)), 3000)
  }, [])

  return (
    <Ctx.Provider value={push}>
      {children}
      {items.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {items.map(t => <div key={t.id} className={`toast${t.kind === 'err' ? ' err' : ''}`}>{t.msg}</div>)}
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
