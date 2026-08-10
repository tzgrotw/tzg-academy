import { Link, useNavigate, useParams } from 'react-router-dom'
import { Page } from '../components/Shell'
import { useCatalog } from '../hooks/useCatalog'
import { useProgress } from '../hooks/useProgress'
import { useSubmissions } from '../hooks/useSubmissions'
import { useAuth } from '../hooks/useAuth'
import { canAccess, AUDIENCE_LABEL, lockHint } from '../lib/tier'
import { countProgress, isDone, nextToWatch, playable } from '../lib/progress'
import { IconAward, IconCheck, IconLock } from '../components/icons'

// 課程介紹頁——封面 hero＋唯一下一步 CTA＋章節大綱＋里程碑。
// 不登入也看得到這一頁（招生用）；內容（教材列）由 RLS 決定撈不撈得到。
export function CoursePage() {
  const { id } = useParams()
  const idNum = Number(id)
  const courseId = id !== undefined && !Number.isNaN(idNum) ? idNum : null
  const navigate = useNavigate()
  const { userId, profile, loading: authLoading } = useAuth()
  const cat = useCatalog()
  const { progressOf, loaded: progLoaded } = useProgress(userId)
  const { submissionOf, loaded: subLoaded } = useSubmissions(userId)

  const course = cat.courses.find(c => c.id === courseId) ?? null
  const loading = !cat.loaded || authLoading || (!!userId && (!progLoaded || !subLoaded))

  if (cat.loaded && !course) {
    return <Page><div className="wrap"><div className="locknote"><h3>找不到這門課</h3>
      <p><Link to="/courses">回全部課程</Link> 挑一門開始。</p></div></div></Page>
  }

  const tier = profile?.tier ?? null
  const open = course ? canAccess(course.audience, tier) : false
  const chapters = course ? cat.chaptersOf(course.id) : []
  const chapterKeys = chapters.map(c => c.key)
  const keySet = new Set(chapterKeys)
  const mats = cat.materials.filter(m => keySet.has(m.chapter_key))
  const vids = countProgress(mats, progressOf)
  const resume = nextToWatch(mats, progressOf, chapterKeys)
  const resumeChapter = resume ? chapters.find(c => c.key === resume.chapter_key) : null
  const pct = vids.total > 0 ? Math.round((vids.done / vids.total) * 100) : 0
  const rewards = course ? cat.rewards.filter(r => r.course_id === course.id) : []
  const endReward = rewards.find(r => !r.after_chapter) ?? null

  // 一章算不算修完：影片全部看完，「而且」這章的測驗／作業（如果有）都要通過——
  // 兩邊都空就不算修完（避免空章節自動打勾）。
  const chapterDone = (key: string) => {
    const rows = playable(mats.filter(m => m.chapter_key === key))
    const chAssessments = cat.assessments.filter(a => a.chapter_key === key && a.is_active)
    if (rows.length === 0 && chAssessments.length === 0) return false
    return rows.every(v => isDone(progressOf(v.id)))
      && chAssessments.every(a => submissionOf(a.id)?.status === 'passed')
  }

  // 整門課的測驗／作業要全部通過，證書才發得出來——跟章節那份邏輯是同一套規則。
  const allAssessments = cat.assessments.filter(a => keySet.has(a.chapter_key) && a.is_active)
  const assessmentsDone = allAssessments.every(a => submissionOf(a.id)?.status === 'passed')
  const courseDone = !resume && vids.total > 0 && assessmentsDone
  const nextAssessmentChapter = !resume && vids.total > 0 && !assessmentsDone
    ? chapters.find(ch => cat.assessments.some(a => a.chapter_key === ch.key && a.is_active && submissionOf(a.id)?.status !== 'passed'))
    : null

  return (
    <Page>
      <header className="chero">
        {course?.cover_url && <img className="bg" src={course.cover_url} alt="" />}
        <div className="veil" />
        <div className="wrap in">
          <Link className="crumb" to="/courses">‹ 回全部課程</Link>
          <p className="eyebrow" style={{ marginTop: 14 }}>{course ? AUDIENCE_LABEL[course.audience].replace(/(.)/g, '$1 ') : ''}</p>
          <h1 className="serif">{course?.title ?? ''}</h1>
          {course?.tagline && <p className="tag">{course.tagline}</p>}
          <div className="meta">
            <span>{chapters.length} 章</span>
            {vids.total > 0 && <span>{vids.total} 支影片</span>}
            {rewards.length > 0 && <span>{rewards.filter(r => r.after_chapter).length} 個里程碑獎勵</span>}
            {endReward && <span>修畢證書</span>}
          </div>
          {!loading && (
            <div className="cta">
              {open && resume && resumeChapter && (
                <>
                  <button className="btn btn-m" onClick={() => navigate(`/learn/${resume.chapter_key}`)}>
                    ▶&nbsp; {vids.done > 0 ? '繼續上課' : '開始上課'}・第 {resumeChapter.no} 章「{resumeChapter.title}」
                  </button>
                  {vids.total > 0 && vids.done > 0 && <span style={{ color: '#CFC3A0', fontSize: 13 }}>已完成 {pct}%</span>}
                </>
              )}
              {open && courseDone && (
                <span className="btn" style={{ background: 'linear-gradient(135deg,#C5B382,#937C44)', color: '#1B1607' }}>
                  <IconAward size={15} /> 這門課修畢了——{endReward?.title ?? '證書'}屬於妳
                </span>
              )}
              {open && nextAssessmentChapter && (
                <button className="btn btn-m" onClick={() => navigate(`/learn/${nextAssessmentChapter.key}`)}>
                  ▶&nbsp; 完成測驗／作業・第 {nextAssessmentChapter.no} 章「{nextAssessmentChapter.title}」
                </button>
              )}
              {open && vids.total === 0 && chapters.length === 0 && (
                <span style={{ color: '#CFC3A0', fontSize: 14 }}>課程準備中——內容建好會出現在這裡</span>
              )}
              {!open && (
                <>
                  {!userId && <Link className="btn btn-m" to="/register">免費註冊開始上課</Link>}
                  <span style={{ color: '#CFC3A0', fontSize: 13 }}>{course ? lockHint(course.audience, tier) : ''}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="ribbonline" />
      </header>

      <div className="wrap two">
        <div className="outline">
          <div className="hd">章節大綱</div>
          {loading && <div className="skel" style={{ margin: '0 26px 22px' }} />}
          {!loading && chapters.map(ch => {
            const rows = playable(mats.filter(m => m.chapter_key === ch.key))
            const doneCnt = rows.filter(v => isDone(progressOf(v.id))).length
            const isNow = resume?.chapter_key === ch.key
            const complete = chapterDone(ch.key)
            const milestone = rewards.find(r => r.after_chapter === ch.key)
            const rowInner = (
              <>
                <span className="no">{ch.no}</span>
                <span className="t">
                  <b>{open ? ch.title : <span className="i"><IconLock size={13} />{ch.title}</span>}{isNow && ' ← 上到這'}</b>
                  {ch.tagline && <span className="sub">{ch.tagline}</span>}
                </span>
                <span className="r">
                  {open && rows.length > 0 && (complete
                    ? <span className="ok i"><IconCheck size={12} />看完</span>
                    : <span>{doneCnt}/{rows.length} 支</span>)}
                </span>
              </>
            )
            return (
              <span key={ch.key}>
                {open
                  ? <Link className={`row${complete ? ' done' : ''}${isNow ? ' now' : ''}`} to={`/learn/${ch.key}`}>{rowInner}</Link>
                  : <span className="row locked">{rowInner}</span>}
                {milestone && (
                  <span className={`row milestone${open && chapterDone(ch.key) ? '' : ' locked'}`}>
                    <span className="no"><IconAward size={15} /></span>
                    <span className="t">
                      <b style={{ color: 'var(--gold-deep)' }}>{milestone.title}</b>
                      <span className="sub">{open && chapterDone(ch.key) ? (milestone.message || '達成了！') : `完成第 ${ch.no} 章解鎖`}</span>
                    </span>
                  </span>
                )}
              </span>
            )
          })}
          {!loading && chapters.length === 0 && (
            <p className="muted" style={{ padding: '10px 26px 24px', fontSize: 13 }}>章節建好會列在這裡。</p>
          )}
        </div>

        <aside className="side">
          {open && vids.total > 0 && (
            <div className="scard">
              <h4>我的進度</h4>
              <div className="prog"><i style={{ width: `${pct}%` }} /></div>
              <p style={{ marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>影片 {vids.done}/{vids.total}</p>
              <p style={{ marginTop: 2 }}>照著「繼續上課」按就對，看到哪記到哪。</p>
            </div>
          )}
          {endReward && (
            <div className="scard">
              <h4>修畢這門課</h4>
              <p>{vids.total > 0
                ? `${vids.total} 支影片全部看完${allAssessments.length > 0 ? '、測驗／作業都通過' : ''}，就能領這門課的專屬證書。`
                : '課程內容建好後，修畢就發證書。'}</p>
              <div className="cert"><b>{endReward.title}</b>
                {endReward.message && <p style={{ marginTop: 6, fontSize: 12 }}>{endReward.message}</p>}
              </div>
            </div>
          )}
          <div className="scard">
            <h4>關於學院</h4>
            <p>泰熙爾札娜學院陪女性把日子過成自己的——創業、自我成長、理財、自媒體、直播、珠寶，一堂一堂學，一步一步走。</p>
          </div>
        </aside>
      </div>
    </Page>
  )
}
