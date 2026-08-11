import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Page } from '../components/Shell'
import { useAuth } from '../hooks/useAuth'
import { useCatalog } from '../hooks/useCatalog'
import { useProgress } from '../hooks/useProgress'
import { useSubmissions } from '../hooks/useSubmissions'
import { canAccess, TIER_LABEL } from '../lib/tier'
import { isDone, nextToWatch, playable } from '../lib/progress'
import { IconAward, IconCheck, IconClipboard, IconFilm } from '../components/icons'
import { CatalogError } from '../components/CatalogError'

// 我的學習——學員自己的儀表板：我的課、每門課看到哪、測驗/作業過了沒、拿到哪些里程碑跟證書。
// 資料全部來自既有的 hooks（catalog + progress + submissions），這一頁只做彙整呈現。
export function MyPage() {
  const { userId, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const cat = useCatalog()
  const { progressOf, loaded: progLoaded } = useProgress(userId)
  const { submissionOf, loaded: subLoaded } = useSubmissions(userId)

  if (!authLoading && !userId) return <Navigate to="/login" replace />

  const loading = authLoading || !cat.loaded || !progLoaded || !subLoaded
  const tier = profile?.tier ?? null

  const myCourses = cat.courses
    .filter(c => c.is_active && canAccess(c.audience, tier))
    .sort((a, b) => a.sort_no - b.sort_no || a.id - b.id)

  // 一門課的完整彙整：影片進度、測驗/作業狀態、章節完成、里程碑/證書
  const summarize = (courseId: number) => {
    const chapters = cat.chaptersOf(courseId)
    const keys = new Set(chapters.map(c => c.key))
    const mats = cat.materials.filter(m => keys.has(m.chapter_key))
    const vids = playable(mats)
    const vidsDone = vids.filter(v => isDone(progressOf(v.id))).length
    const assessments = cat.assessments.filter(a => keys.has(a.chapter_key) && a.is_active)
    const passed = assessments.filter(a => submissionOf(a.id)?.status === 'passed').length
    const pending = assessments.filter(a => submissionOf(a.id)?.status === 'pending').length
    const resume = nextToWatch(mats, progressOf, chapters.map(c => c.key))

    const chapterDone = (key: string) => {
      const rows = playable(mats.filter(m => m.chapter_key === key))
      const chAssess = assessments.filter(a => a.chapter_key === key)
      if (rows.length === 0 && chAssess.length === 0) return false
      return rows.every(v => isDone(progressOf(v.id)))
        && chAssess.every(a => submissionOf(a.id)?.status === 'passed')
    }

    const rewards = cat.rewards.filter(r => r.course_id === courseId)
    const milestonesEarned = rewards.filter(r => r.after_chapter && chapterDone(r.after_chapter))
    const cert = rewards.find(r => !r.after_chapter) ?? null
    const courseDone = (vids.length > 0 || assessments.length > 0)
      && vids.every(v => isDone(progressOf(v.id)))
      && assessments.every(a => submissionOf(a.id)?.status === 'passed')
    const pct = vids.length > 0 ? Math.round((vidsDone / vids.length) * 100) : 0

    return { chapters, vids, vidsDone, pct, assessments, passed, pending, resume, milestonesEarned, cert, courseDone }
  }

  const summaries = myCourses.map(c => ({ course: c, s: summarize(c.id) }))
  const started = summaries.filter(({ s }) => s.vidsDone > 0 || s.passed > 0 || s.pending > 0)
  const certsEarned = summaries.filter(({ s }) => s.courseDone && s.cert)
  const allMilestones = summaries.flatMap(({ course, s }) =>
    s.milestonesEarned.map(m => ({ course, milestone: m })))

  return (
    <Page>
      <div className="wrap" style={{ paddingBottom: 90 }}>
        <div className="admin-hd">
          <h1 className="serif">我的學習</h1>
          {profile && <span className={`tierchip ${profile.tier}`}>{TIER_LABEL[profile.tier]}</span>}
        </div>

        {loading && <div className="skel" style={{ marginTop: 24 }} />}
        {!loading && cat.error && <CatalogError message={cat.error} retry={cat.reload} />}

        {!loading && !cat.error && (
          <>
            {(certsEarned.length > 0 || allMilestones.length > 0) && (
              <div className="acard">
                <h3 className="i"><IconAward size={17} />我的獎章與證書（{certsEarned.length + allMilestones.length}）</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
                  {certsEarned.map(({ course, s }) => (
                    <div key={`cert-${course.id}`} className="cert" style={{ background: 'linear-gradient(135deg,#FCF8EC,#F4ECD6)', border: '1px solid var(--gold)', borderRadius: 14, padding: '14px 18px' }}>
                      <b style={{ color: 'var(--gold-deep)', fontSize: 13.5, letterSpacing: '.08em' }}>{s.cert!.title}</b>
                      <p style={{ fontSize: 12, color: 'var(--tx-muted)', marginTop: 4 }}>{course.title}・修畢證書</p>
                    </div>
                  ))}
                  {allMilestones.map(({ course, milestone }) => (
                    <div key={`ms-${milestone.id}`} style={{ background: '#FBF8EF', border: '1px solid rgba(197,179,130,.4)', borderRadius: 14, padding: '14px 18px' }}>
                      <b style={{ fontSize: 13, color: 'var(--gold-deep)' }} className="i"><IconAward size={13} />{milestone.title}</b>
                      <p style={{ fontSize: 12, color: 'var(--tx-muted)', marginTop: 4 }}>{course.title}・里程碑</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="acard">
              <h3>我的課程（{myCourses.length}）</h3>
              {myCourses.length === 0 && (
                <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
                  還沒有可以上的課——<Link to="/courses" style={{ color: 'var(--magenta)', fontWeight: 700 }}>去挑一門</Link>開始。
                </p>
              )}
              {summaries.map(({ course, s }) => (
                <div key={course.id} className="arow" style={{ alignItems: 'flex-start' }}>
                  <div className="grow" style={{ minWidth: 220 }}>
                    <b>{course.title}</b>
                    <span className="sub">
                      {s.chapters.length} 章
                      {s.vids.length > 0 && <>・影片 {s.vidsDone}/{s.vids.length}</>}
                      {s.assessments.length > 0 && <>・測驗／作業 {s.passed}/{s.assessments.length} 過關{s.pending > 0 && `（${s.pending} 份待批改）`}</>}
                    </span>
                    {s.vids.length > 0 && (
                      <div className="prog" style={{ marginTop: 8, maxWidth: 320 }}><i style={{ width: `${s.pct}%` }} /></div>
                    )}
                    {s.courseDone && s.cert && (
                      <p className="i" style={{ fontSize: 12.5, color: 'var(--gold-deep)', marginTop: 6 }}>
                        <IconAward size={13} />修畢——{s.cert.title}已到手
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    {s.courseDone
                      ? <button className="btn-line" onClick={() => navigate(`/course/${course.id}`)}>回顧課程</button>
                      : s.resume
                        ? <button className="btn btn-s" onClick={() => navigate(`/learn/${s.resume!.chapter_key}`)}>
                            {s.vidsDone > 0 || s.passed > 0 ? '繼續上課' : '開始上課'}
                          </button>
                        : <button className="btn-line" onClick={() => navigate(`/course/${course.id}`)}>看課程</button>}
                  </div>
                </div>
              ))}
            </div>

            {started.length > 0 && (
              <div className="acard">
                <h3 className="i"><IconClipboard size={16} />測驗與作業</h3>
                {started.every(({ s }) => s.assessments.length === 0) && (
                  <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>妳的課程目前沒有測驗或作業。</p>
                )}
                {summaries.flatMap(({ course, s }) =>
                  s.assessments.map(a => {
                    const sub = submissionOf(a.id)
                    const chapter = s.chapters.find(c => c.key === a.chapter_key)
                    return (
                      <div key={a.id} className="arow">
                        <span className={`kindchip ${a.kind}`}>{a.kind === 'quiz' ? '測驗' : '作業'}</span>
                        <div className="grow">
                          <b style={{ fontSize: 13.5 }}>{a.title}</b>
                          <span className="sub">{course.title}{chapter ? ` ‹ 第 ${chapter.no} 章` : ''}</span>
                          {sub?.status === 'failed' && sub.feedback && (
                            <span className="sub" style={{ color: '#B0483C' }}>老師回饋：{sub.feedback}</span>
                          )}
                        </div>
                        {sub
                          ? <span className={`statuschip ${sub.status}`}>
                              {sub.status === 'passed' ? (a.kind === 'quiz' && sub.score_pct != null ? `通過・${sub.score_pct}分` : '通過')
                                : sub.status === 'pending' ? '待批改'
                                : (a.kind === 'quiz' ? '未通過' : '被退回')}
                            </span>
                          : <span className="sub" style={{ flex: 'none' }}>還沒作答</span>}
                        {(!sub || sub.status !== 'passed') && chapter && (
                          <button className="btn-line" onClick={() => navigate(`/learn/${a.chapter_key}`)}>
                            {sub ? '再試一次' : '去作答'}
                          </button>
                        )}
                      </div>
                    )
                  }))}
              </div>
            )}

            <div className="acard">
              <h3 className="i"><IconFilm size={16} />接下來</h3>
              {(() => {
                const next = summaries.find(({ s }) => s.resume)
                if (!next?.s.resume) {
                  return <p className="muted i" style={{ marginTop: 14, fontSize: 13 }}><IconCheck size={13} />目前的影片都看完了——去「全部課程」看看還有什麼新課。</p>
                }
                const ch = next.s.chapters.find(c => c.key === next.s.resume!.chapter_key)
                return (
                  <div className="arow">
                    <div className="grow">
                      <b style={{ fontSize: 13.5 }}>{next.s.resume.label}</b>
                      <span className="sub">{next.course.title}{ch ? ` ‹ 第 ${ch.no} 章「${ch.title}」` : ''}</span>
                    </div>
                    <button className="btn btn-s" onClick={() => navigate(`/learn/${next.s.resume!.chapter_key}`)}>繼續看</button>
                  </div>
                )
              })()}
            </div>
          </>
        )}
      </div>
    </Page>
  )
}
