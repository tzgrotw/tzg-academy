import { useMemo, useState, type ReactNode } from 'react'

export interface Column<T> {
  key: string
  title: string
  render: (row: T) => ReactNode
  /** 提供就可點表頭排序 */
  sort?: (a: T, b: T) => number
  /** 數字欄靠右 */
  num?: boolean
}

/** 資料表小工具——搜尋、排序、空狀態一次到位。
 *  searchText 提供時工具列出現搜尋框（比對該函式回傳的字串）；
 *  filters 塞下拉選單之類的額外控制。 */
export function DataTable<T>({ rows, columns, rowKey, searchText, searchPlaceholder, filters, empty, onRowClick }: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  searchText?: (row: T) => string
  searchPlaceholder?: string
  filters?: ReactNode
  empty: string
  onRowClick?: (row: T) => void
}) {
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [dir, setDir] = useState<1 | -1>(1)

  const visible = useMemo(() => {
    let list = rows
    const needle = q.trim().toLowerCase()
    if (searchText && needle) list = list.filter(r => searchText(r).toLowerCase().includes(needle))
    const col = columns.find(c => c.key === sortKey)
    if (col?.sort) list = [...list].sort((a, b) => col.sort!(a, b) * dir)
    return list
  }, [rows, q, sortKey, dir, columns, searchText])

  const clickSort = (col: Column<T>) => {
    if (!col.sort) return
    if (sortKey === col.key) setDir(d => (d === 1 ? -1 : 1))
    else { setSortKey(col.key); setDir(1) }
  }

  return (
    <>
      {(searchText || filters) && (
        <div className="adm-toolbar">
          {searchText && (
            <input type="search" value={q} onChange={e => setQ(e.target.value)}
              placeholder={searchPlaceholder ?? '搜尋…'} aria-label="搜尋" />
          )}
          {filters}
        </div>
      )}
      <div className="adm-table-wrap">
        {visible.length === 0
          ? <div className="adm-empty">{q ? `找不到符合「${q}」的資料` : empty}</div>
          : (
            <table className="adm-table">
              <thead><tr>
                {columns.map(c => (
                  <th key={c.key} className={`${c.sort ? 'sortable' : ''}${c.num ? ' num' : ''}`}
                    onClick={() => clickSort(c)}>
                    {c.title}{sortKey === c.key ? (dir === 1 ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {visible.map(r => (
                  <tr key={rowKey(r)} className={onRowClick ? 'clickable' : ''}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}>
                    {columns.map(c => <td key={c.key} className={c.num ? 'num' : ''}>{c.render(r)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </>
  )
}
