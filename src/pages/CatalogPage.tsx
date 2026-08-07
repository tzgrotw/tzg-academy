import { useState } from 'react'
import { Page } from '../components/Shell'
import { CourseCard } from '../components/CourseCard'
import { useCatalog } from '../hooks/useCatalog'
import type { Audience } from '../lib/types'

// 全部課程＝學員選課的家（老闆 2026-08-05：「應該還有一個首頁我可以選擇課程用的」）
export function CatalogPage() {
  const cat = useCatalog()
  const [filter, setFilter] = useState<'all' | Audience>('all')

  const active = cat.courses.filter(c => c.is_active)
  const shown = filter === 'all' ? active : active.filter(c => c.audience === filter)
  const FILTERS: { key: 'all' | Audience; label: string }[] = [
    { key: 'all', label: `全部（${active.length}）` },
    { key: 'public', label: '公開・免費' },
    { key: 'member', label: '會員課程' },
    { key: 'agent', label: '代理專屬' },
  ]

  return (
    <Page>
      <div className="wrap cat-hd">
        <p className="eyebrow" style={{ color: 'var(--magenta)', letterSpacing: '.4em' }}>ALL COURSES</p>
        <h1 className="serif">全部課程</h1>
        <p>挑一門有興趣的開始——公開課免費看，會員課入會解鎖，看到哪自動記到哪。</p>
        <div className="filters">
          {FILTERS.map(f => (
            <button key={f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
      </div>
      <div className="wrap catgrid">
        {!cat.loaded && <div className="skel" />}
        {cat.loaded && shown.length === 0 && (
          <p className="muted" style={{ marginTop: 28 }}>這一類還沒有課——換個分類看看。</p>
        )}
        <div className="grid">
          {shown.map(c => {
            const { chapterCount, videoCount } = cat.courseStats(c.id)
            return <CourseCard key={c.id} course={c} chapterCount={chapterCount} videoCount={videoCount} />
          })}
        </div>
      </div>
    </Page>
  )
}
