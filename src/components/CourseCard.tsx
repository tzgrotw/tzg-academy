import { Link } from 'react-router-dom'
import { AUDIENCE_LABEL, canAccess } from '../lib/tier'
import type { Course } from '../lib/types'
import { useAuth } from '../hooks/useAuth'
import { IconLock } from './icons'

/** 課程卡——目錄與首頁共用。上鎖與否只影響 chip 和動作文字，
 *  卡片一律可點（點進介紹頁才看得到「如何解鎖」，上鎖卡不是死卡）。 */
export function CourseCard({ course, chapterCount, videoCount }: {
  course: Course
  chapterCount: number
  videoCount: number
}) {
  const { profile } = useAuth()
  const open = canAccess(course.audience, profile?.tier ?? null)
  const free = course.audience === 'public'
  return (
    <Link to={`/course/${course.id}`} className="course">
      <span className="covwrap">
        {course.cover_url
          ? <img className="cov" src={course.cover_url} alt="" loading="lazy" />
          : <span className="ph serif">泰</span>}
        <span className={`chip i ${free ? 'free' : 'lock'}`}>
          {free ? AUDIENCE_LABEL.public : <><IconLock size={11} />{AUDIENCE_LABEL[course.audience]}</>}
        </span>
      </span>
      <span className="bd">
        <h3 className="serif">{course.title}</h3>
        {course.tagline && <span className="desc">{course.tagline}</span>}
        <span className="meta">
          <span>{chapterCount} 章</span>・<span>{videoCount} 支影片</span>
          <span className="go">{open || free ? '進去上課 →' : '如何解鎖 →'}</span>
        </span>
      </span>
    </Link>
  )
}
