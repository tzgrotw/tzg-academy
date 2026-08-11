export function CatalogError({ message, retry }: { message: string; retry: () => Promise<void> }) {
  return (
    <div className="load-error" role="alert">
      <b>暫時無法載入課程</b>
      <p>{message}</p>
      <button className="btn-line" onClick={() => void retry()}>重新載入</button>
    </div>
  )
}
