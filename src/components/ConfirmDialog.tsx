import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ConfirmState {
  message: string
  danger: boolean
  resolve: (ok: boolean) => void
}

const Ctx = createContext<((message: string, opts?: { danger?: boolean }) => Promise<boolean>) | null>(null)

/** 全站共用一個確認視窗——刪除這種不能復原的動作都走這裡，
 *  不用瀏覽器內建那個 confirm()（跟品牌風格不搭、手機上也醜）。 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null)
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((message: string, opts?: { danger?: boolean }) =>
    new Promise<boolean>(resolve => {
      resolveRef.current = resolve
      setState({ message, danger: opts?.danger ?? false, resolve })
    }), [])

  function close(ok: boolean) {
    resolveRef.current?.(ok)
    setState(null)
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {state && (
        <div className="confirm-veil" onClick={() => close(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <p>{state.message}</p>
            <div className="confirm-actions">
              <button className="btn-line" onClick={() => close(false)}>取消</button>
              <button className={state.danger ? 'btn btn-danger' : 'btn btn-s'} onClick={() => close(true)}>確定</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useConfirm() {
  const confirm = useContext(Ctx)
  if (!confirm) throw new Error('useConfirm 要包在 <ConfirmProvider> 裡面才能用')
  return confirm
}
