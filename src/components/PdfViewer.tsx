import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const MIN_SCALE = 0.6
const MAX_SCALE = 2.4

/** 自己刻的講義閱讀器（pdf.js 畫到 canvas 上）——不再丟出去給瀏覽器內建那個
 *  陽春 PDF 檢視器，翻頁/縮放都在頁面裡，跟網站風格一致。 */
export function PdfViewer({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.1)
  const [busy, setBusy] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setBusy(true); setErr(null)
    const task = pdfjsLib.getDocument({ url })
    task.promise.then(d => {
      if (!alive) return
      setDoc(d); setNumPages(d.numPages); setPage(1); setBusy(false)
    }).catch(() => { if (alive) { setErr('講義載入失敗——網路不穩或連結過期了，收起來再點一次'); setBusy(false) } })
    return () => { alive = false; void task.destroy() }
  }, [url])

  useEffect(() => {
    if (!doc) return
    let alive = true
    void doc.getPage(page).then(p => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx || !alive) return
      const viewport = p.getViewport({ scale })
      canvas.width = viewport.width
      canvas.height = viewport.height
      void p.render({ canvasContext: ctx, viewport, canvas }).promise
    })
    return () => { alive = false }
  }, [doc, page, scale])

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <button className="btn-line" onClick={onClose}>收起</button>
        <span className="pdf-title">{label}</span>
        <div className="pdf-controls">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="上一頁">‹</button>
          <span>{numPages ? `${page} / ${numPages}` : '—'}</span>
          <button disabled={page >= numPages} onClick={() => setPage(p => p + 1)} aria-label="下一頁">›</button>
          <button disabled={scale <= MIN_SCALE} onClick={() => setScale(s => Math.max(MIN_SCALE, s - 0.2))} aria-label="縮小">－</button>
          <button disabled={scale >= MAX_SCALE} onClick={() => setScale(s => Math.min(MAX_SCALE, s + 0.2))} aria-label="放大">＋</button>
          <a href={url} target="_blank" rel="noreferrer">在新分頁開啟</a>
        </div>
      </div>
      <div className="pdf-canvas-wrap">
        {busy && <div className="skel" style={{ width: 280, margin: 0 }} />}
        {err && <p className="formerr">{err}</p>}
        {!busy && !err && <canvas ref={canvasRef} />}
      </div>
    </div>
  )
}
