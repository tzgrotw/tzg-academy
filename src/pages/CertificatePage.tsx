import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Page } from '../components/Shell'
import { supabase } from '../lib/supabase'
import type { VerifiedCertificate } from '../lib/types'

export function CertificatePage() {
  const { code = '' } = useParams()
  const [certificate, setCertificate] = useState<VerifiedCertificate | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [qr, setQr] = useState('')
  const [downloading, setDownloading] = useState(false)
  const certificateRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let alive = true
    supabase.rpc('fn_verify_certificate', { p_code: code }).then(({ data }) => {
      if (!alive) return
      setCertificate(((data as VerifiedCertificate[] | null) ?? [])[0] ?? null)
      setLoaded(true)
    })
    return () => { alive = false }
  }, [code])

  useEffect(() => {
    if (!certificate) return
    void QRCode.toDataURL(`${window.location.origin}/certificate/${encodeURIComponent(code)}`, {
      width: 220, margin: 1, color: { dark: '#171307', light: '#FFFFFF' },
    }).then(setQr)
  }, [certificate, code])

  async function downloadPdf() {
    if (!certificateRef.current || !certificate) return
    setDownloading(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      const canvas = await html2canvas(certificateRef.current, { scale: 2, useCORS: true, backgroundColor: '#FBF8F1' })
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      pdf.addImage(canvas.toDataURL('image/jpeg', .95), 'JPEG', 0, 0, 297, 210)
      pdf.save(`${certificate.certificate_no}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  if (!loaded) return <Page><div className="wrap"><div className="skel" style={{ marginTop: 40 }} /></div></Page>
  if (!certificate) return (
    <Page><div className="wrap"><div className="verify-card invalid" role="alert">
      <h1 className="serif">找不到這張證書</h1>
      <p>請確認證書編號或驗證網址是否完整。</p>
      <Link className="btn-line" to="/">回學院首頁</Link>
    </div></div></Page>
  )

  const issuedDate = new Intl.DateTimeFormat('zh-TW', { dateStyle: 'long' }).format(new Date(certificate.issued_at))
  return (
    <Page>
      <div className="certificate-page wrap">
        <div className={`verify-status ${certificate.valid ? 'valid' : 'invalid'}`} role="status">
          <b>{certificate.valid ? '✓ 此證書有效' : '此證書已撤銷'}</b>
          <span>證書編號 {certificate.certificate_no}</span>
        </div>
        <div className="certificate-sheet" ref={certificateRef} aria-label={`${certificate.learner_name} 的${certificate.certificate_title}`}>
          <div className="certificate-frame">
            <p className="certificate-brand">泰 熙 爾 札 娜 ・ 學 院</p>
            <p className="certificate-en">TZG ACADEMY</p>
            <h1 className="serif">{certificate.certificate_title}</h1>
            <p className="certificate-copy">茲證明</p>
            <h2 className="serif">{certificate.learner_name}</h2>
            <p className="certificate-copy">已完成「{certificate.course_title}」全部課程要求，特頒此證。</p>
            <div className="certificate-rule" />
            <div className="certificate-meta">
              <div><span>核發日期</span><b>{issuedDate}</b></div>
              <div><span>證書編號</span><b>{certificate.certificate_no}</b></div>
              {qr && <div className="certificate-qr"><img src={qr} alt="證書公開驗證 QR Code" /><span>掃描驗證</span></div>}
            </div>
            {!certificate.valid && <div className="certificate-revoked">已撤銷</div>}
          </div>
        </div>
        <div className="certificate-actions">
          {certificate.valid && <button className="btn btn-m" disabled={downloading} onClick={() => void downloadPdf()}>
            {downloading ? '正在產生 PDF…' : '下載 PDF 證書'}
          </button>}
          <button className="btn-line" onClick={() => window.print()}>列印</button>
          <Link className="btn-line" to="/my">回我的學習</Link>
        </div>
      </div>
    </Page>
  )
}
