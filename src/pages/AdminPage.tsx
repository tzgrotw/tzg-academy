import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Page } from '../components/Shell'
import { useAuth } from '../hooks/useAuth'
import { useAdminMembers } from '../hooks/useAdminMembers'
import { useAdminContent } from '../hooks/useAdminContent'
import { useAdminSubmissions } from '../hooks/useAdminSubmissions'
import { useAdminTrash } from '../hooks/useAdminTrash'
import { useCatalog } from '../hooks/useCatalog'
import { supabase } from '../lib/supabase'
import { AUDIENCE_LABEL, TIER_LABEL, canAccess } from '../lib/tier'
import { isDone, playable } from '../lib/progress'
import { IconCheck, IconChevron, IconFileText, IconFilm, IconTrash } from '../components/icons'
import { ConfirmProvider, useConfirm } from '../components/ConfirmDialog'
import { commitOrder, DragHandle, SortableList, type DragHandleProps } from '../components/Sortable'
import type { Assessment, AssessmentKind, AssessmentSubmission, Audience, Chapter, Course, Material, Profile, Progress, QuizQuestion, Reward, Section, Tier } from '../lib/types'

// 後台——四個分頁：會員（搜尋＋一鍵改身分）、課程（課程列表 → 點進去看該課的章節/教材/測驗）、作業批改、垃圾桶。
// 課程結構跟課程設定分開兩塊；排序用拖曳（SortableList）；刪除都走 ConfirmDialog 確認，砍下去是軟刪除
// （進垃圾桶，不是真的沒了）——誤刪從垃圾桶分頁救得回來。
// 資料存取都在 hooks/useAdminMembers、useAdminContent、useAdminSubmissions、useAdminTrash；這裡只管畫面。

export function AdminPage() {
  const { profile, loading } = useAuth()
  const [tab, setTab] = useState<'members' | 'content' | 'grading' | 'trash' | 'guide'>('members')

  if (loading) return <Page><div className="wrap"><div className="skel" style={{ marginTop: 40 }} /></div></Page>
  if (profile?.tier !== 'admin') return <Navigate to="/" replace />

  return (
    <ConfirmProvider>
      <Page>
        <div className="wrap" style={{ paddingBottom: 90 }}>
          <div className="admin-hd">
            <h1 className="serif">學院後台</h1>
            <div className="admin-tabs">
              <button className={tab === 'members' ? 'on' : ''} onClick={() => setTab('members')}>會員</button>
              <button className={tab === 'content' ? 'on' : ''} onClick={() => setTab('content')}>課程</button>
              <button className={tab === 'grading' ? 'on' : ''} onClick={() => setTab('grading')}>作業批改</button>
              <button className={tab === 'trash' ? 'on' : ''} onClick={() => setTab('trash')}>垃圾桶</button>
              <button className={tab === 'guide' ? 'on' : ''} onClick={() => setTab('guide')}>使用說明</button>
            </div>
          </div>
          {tab === 'members' ? <MembersTab /> : tab === 'content' ? <ContentTab />
            : tab === 'grading' ? <GradingTab /> : tab === 'trash' ? <TrashTab /> : <GuideTab />}
        </div>
      </Page>
    </ConfirmProvider>
  )
}

/* ───────────────────────── 使用說明（交接手冊）───────────────────────── */

function GuideTab() {
  const S = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="curr-section">
      <div className="curr-section-hd"><h4>{title}</h4></div>
      <div style={{ fontSize: 13.5, lineHeight: 1.9, color: 'var(--tx-soft)' }}>{children}</div>
    </div>
  )
  return (
    <div className="acard">
      <h3>平台使用說明（交接手冊）</h3>
      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        給接手管理這個平台的人看的——整個學院的遊戲規則都在這一頁。
      </p>

      <S title="會員身分（三級）">
        <p><b>會員</b>：免費註冊就有，看得到「公開」跟「會員課程」。<b>代理</b>：再多看「代理專屬」課。<b>管理員</b>：進得來這個後台。
        改身分：後台「會員」分頁 → 點開該會員 → 按「改成◯◯」。沒有金流串接，開通身分目前是人工作業。</p>
      </S>

      <S title="課程結構">
        <p>一門<b>課程</b>底下有很多<b>章節</b>；每一章裡面可以放三種東西：<b>小節內文</b>（條列重點＋講師提醒）、<b>教材</b>（影片或講義 PDF）、<b>測驗／作業</b>。
        每一層都可以拖曳「⠿」把手排順序、可以停用（學員暫時看不到、資料還在）、可以刪除（先進垃圾桶）。
        課程有「觀看對象」設定（公開／會員／代理），鎖的是內容，課名跟封面所有人都看得到（招生用）。</p>
      </S>

      <S title="影片與講義">
        <p>影片兩種來源：後台直接上傳檔案（存在我們自己的空間，學員播放走加密簽名網址），或貼 YouTube 網址（影片要設「不公開」，不要「私人」）。
        大批影片建議用工程師腳本 <code>npm run upload:youtube</code> 從 Google Drive 批次搬上 YouTube。
        講義上傳 PDF，學員在頁面內建的閱讀器直接看。教材名稱、YouTube 網址都可以事後在教材列上直接改。</p>
      </S>

      <S title="進度怎麼算">
        <p>自家上傳的影片：看到 95% 自動算看完，中途關掉會記住看到哪、下次接著播。
        YouTube 影片：技術上抓不到播放進度，學員看完自己按「看完了・標記這支」。講義不算進度。</p>
      </S>

      <S title="測驗與作業的規則">
        <p><b>測驗</b>（選擇題）：在章節裡按「＋加測驗」，逐題設定選項並圈選正確答案、設定及格 %。
        學員送出後系統自動評分；沒過可以重考，成績以最新一次為準。正確答案存在資料庫端，學員從瀏覽器看不到。
        <b>作業</b>：按「＋加作業」，寫清楚要交什麼。學員上傳檔案（可附說明）後進「作業批改」分頁排隊，
        管理員看檔案 → 寫評語 →「通過」或「退回」。被退回的學員會看到評語，可以重交。</p>
      </S>

      <S title="修畢、里程碑與證書">
        <p>一章算修完 ＝ 該章影片全部看完 <b>而且</b> 該章的測驗／作業全部「通過」（待批改不算）。
        整門課修完 ＝ 每一章都修完 → 學員拿到<b>結業證書</b>。
        證書的名稱跟文案在「課程」分頁 → 點進該課 → 最下面「里程碑與證書」設定；同一區也可以加<b>章節里程碑</b>（完成某一章就跳出的獎勵訊息），一門課可以放很多個。
        學員在「我的學習」頁看得到自己拿到的所有獎章跟證書。</p>
      </S>

      <S title="誤刪救援（垃圾桶）">
        <p>後台按刪除都是先丟進「垃圾桶」分頁，不是真的消失——點「還原」整個救回來（連底下的章節教材一起）。
        在垃圾桶裡再按一次刪除才是永久刪除，那就真的救不回來了。</p>
      </S>

      <S title="每個月要記得的事">
        <p>目前沒有自動金流——會員匯款／購課後，要人工到後台把她的身分改成對應等級。
        新課上線前用一個測試會員帳號自己走一遍：看影片 → 做測驗 → 交作業 → 批改 → 確認證書會跳出來。
        資料庫結構有更動時（工程師會說），把 <code>supabase/schema.sql</code> 整份貼到 Supabase SQL Editor 重跑一次即可，重複執行是安全的。</p>
      </S>
    </div>
  )
}

/* ───────────────────────── 會員 ───────────────────────── */

function MembersTab() {
  const members = useAdminMembers()
  const { rows, loaded, q, setQ, shown } = members
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = rows.find(p => p.user_id === selectedId) ?? null
  if (selected) {
    return <MemberDetail member={selected} members={members} onBack={() => setSelectedId(null)} />
  }

  return (
    <div className="acard">
      <h3>會員（{rows.length}）</h3>
      <div className="searchbar">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜名字或 Email…" />
      </div>
      {!loaded && <div className="skel" />}
      {loaded && shown.length === 0 && <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>沒有符合的會員。</p>}
      {shown.map(p => (
        <div className="arow" key={p.user_id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(p.user_id)}>
          <div className="grow">
            <b>{p.name || '（沒填名字）'}</b>
            <span className="sub">{p.email}・{new Date(p.created_at).toLocaleDateString('zh-TW')} 加入</span>
          </div>
          <span className={`tierchip ${p.tier}`}>{TIER_LABEL[p.tier]}</span>
          <span style={{ color: 'var(--tx-muted)' }}><IconChevron size={15} /></span>
        </div>
      ))}
    </div>
  )
}

/** 會員詳細頁——改名字、改身分、看她每門課的進度跟測驗/作業狀況。
 *  進度資料靠 progress_admin_read RLS（管理員唯讀）；筆記是私人的，後台看不到。 */
function MemberDetail({ member, members, onBack }: {
  member: Profile
  members: ReturnType<typeof useAdminMembers>
  onBack: () => void
}) {
  const cat = useCatalog()
  const [name, setName] = useState(member.name)
  const [err, setErr] = useState<string | null>(null)
  const [progRows, setProgRows] = useState<Progress[]>([])
  const [subRows, setSubRows] = useState<AssessmentSubmission[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    setDataLoaded(false)
    Promise.all([
      supabase.from('video_progress').select('*').eq('user_id', member.user_id),
      supabase.from('assessment_submissions').select('*').eq('user_id', member.user_id),
    ]).then(([p, s]) => {
      if (!alive) return
      setProgRows((p.data as Progress[] | null) ?? [])
      setSubRows((s.data as AssessmentSubmission[] | null) ?? [])
      setDataLoaded(true)
    })
    return () => { alive = false }
  }, [member.user_id])

  const progOf = (videoId: number) => progRows.find(r => r.video_id === videoId) ?? null
  const subOf = (assessmentId: number) => subRows.find(r => r.assessment_id === assessmentId) ?? null

  async function saveName() {
    setErr(await members.setName(member.user_id, name.trim()))
  }

  const courseRows = cat.courses
    .filter(c => canAccess(c.audience, member.tier))
    .sort((a, b) => a.sort_no - b.sort_no || a.id - b.id)
    .map(course => {
      const chapters = cat.chaptersOf(course.id)
      const keys = new Set(chapters.map(c => c.key))
      const vids = playable(cat.materials.filter(m => keys.has(m.chapter_key)))
      const vidsDone = vids.filter(v => isDone(progOf(v.id))).length
      const assessments = cat.assessments.filter(a => keys.has(a.chapter_key) && a.is_active)
      const passed = assessments.filter(a => subOf(a.id)?.status === 'passed').length
      return { course, vids, vidsDone, assessments, passed }
    })

  return (
    <div className="acard">
      <button className="curr-back" onClick={onBack}>
        <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><IconChevron size={14} /></span>回會員列表
      </button>

      <div className="curr-section" style={{ marginTop: 0 }}>
        <div className="curr-section-hd"><h4>基本資料</h4></div>
        <div className="inline-form" style={{ marginTop: 0 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="名字" style={{ minWidth: 180 }} />
          {name.trim() !== member.name && (
            <button className="btn btn-s" disabled={members.busyId === member.user_id} onClick={() => void saveName()}>存</button>
          )}
          <span className="sub" style={{ alignSelf: 'center' }}>{member.email}・{new Date(member.created_at).toLocaleDateString('zh-TW')} 加入</span>
        </div>
        <div className="inline-form">
          <span className={`tierchip ${member.tier}`} style={{ alignSelf: 'center' }}>{TIER_LABEL[member.tier]}</span>
          {(['member', 'agent', 'admin'] as Tier[]).filter(t => t !== member.tier).map(t => (
            <button key={t} className="btn-line" disabled={members.busyId === member.user_id}
              onClick={() => void members.setTier(member, t)}>改成{TIER_LABEL[t]}</button>
          ))}
        </div>
        {err && <p className="formerr">{err}</p>}
      </div>

      <div className="curr-section">
        <div className="curr-section-hd"><h4>學習狀況</h4></div>
        {(!dataLoaded || !cat.loaded) && <div className="skel" />}
        {dataLoaded && cat.loaded && courseRows.length === 0 && (
          <p className="muted" style={{ fontSize: 13 }}>這個身分目前沒有可上的課程。</p>
        )}
        {dataLoaded && cat.loaded && courseRows.map(({ course, vids, vidsDone, assessments, passed }) => (
          <div className="arow" key={course.id}>
            <div className="grow">
              <b style={{ fontSize: 13.5 }}>{course.title}</b>
              <span className="sub">
                {vids.length === 0 && assessments.length === 0 && '（課程還沒有內容）'}
                {vids.length > 0 && `影片 ${vidsDone}/${vids.length}`}
                {assessments.length > 0 && `${vids.length > 0 ? '・' : ''}測驗／作業 ${passed}/${assessments.length} 過關`}
              </span>
              {vids.length > 0 && (
                <div className="prog" style={{ marginTop: 6, maxWidth: 260 }}>
                  <i style={{ width: `${Math.round((vidsDone / vids.length) * 100)}%` }} />
                </div>
              )}
            </div>
            {vids.length > 0 && vidsDone === vids.length && (assessments.length === 0 || passed === assessments.length) && (
              <span className="statuschip passed">修畢</span>
            )}
          </div>
        ))}
      </div>

      {dataLoaded && subRows.length > 0 && (
        <div className="curr-section">
          <div className="curr-section-hd"><h4>測驗／作業紀錄（{subRows.length}）</h4></div>
          {subRows.map(s => {
            const a = cat.assessments.find(x => x.id === s.assessment_id)
            return (
              <div className="arow" key={s.assessment_id}>
                <div className="grow">
                  <b style={{ fontSize: 13 }}>{a?.title ?? '（已刪除的測驗／作業）'}</b>
                  <span className="sub">
                    {new Date(s.submitted_at).toLocaleString('zh-TW')} 繳交
                    {s.score_pct != null && `・${s.score_pct} 分`}
                  </span>
                </div>
                <span className={`statuschip ${s.status}`}>
                  {s.status === 'passed' ? '通過' : s.status === 'pending' ? '待批改' : '未過'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── 課程：課程列表 → 課程詳細 ───────────────────────── */

type AdminContent = ReturnType<typeof useAdminContent>
type Confirm = ReturnType<typeof useConfirm>

function ContentTab() {
  const content = useAdminContent()
  const confirm = useConfirm()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const sortedCourses = [...content.courses].sort((a, b) => a.sort_no - b.sort_no || a.id - b.id)
  const selected = sortedCourses.find(c => c.id === selectedId) ?? null

  async function createCourse() {
    setMsg(await content.createCourse())
  }

  async function deleteCourse(course: Course) {
    const ok = await confirm(`確定要刪除「${course.title}」？裡面的章節、教材會一起砍掉，不能復原。`, { danger: true })
    if (!ok) return
    setMsg(await content.deleteCourse(course.id))
  }

  function reorderCourses(newOrder: Course[]) {
    commitOrder(newOrder, (c, sortNo) => void content.updateCourse(c.id, { sort_no: sortNo }))
  }

  if (selected) {
    return <CourseDetail key={selected.id} course={selected} content={content} confirm={confirm}
      onBack={() => setSelectedId(null)} />
  }

  return (
    <>
      {msg && <p className="formerr">{msg}</p>}
      <div className="acard">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ flex: 1 }}>課程（{content.courses.length}）</h3>
          <button className="btn btn-s" onClick={() => void createCourse()}>＋開新課程</button>
        </div>
        {!content.loaded && <div className="skel" />}
        {content.loaded && sortedCourses.length === 0 && (
          <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>還沒有課程，點右上角開一門。</p>
        )}
        <SortableList items={sortedCourses} getId={c => String(c.id)} onReorder={reorderCourses}>
          {(c, handle) => (
            <div className="curr-row">
              <DragHandle {...handle} />
              <div className="grow" onClick={() => setSelectedId(c.id)}>
                <b>{c.title}</b>
                <span className="sub">
                  {AUDIENCE_LABEL[c.audience]}・{content.chapters.filter(ch => ch.course_id === c.id).length} 章{c.is_active ? '' : '・已下架'}
                </span>
              </div>
              <button className="icon-btn danger" title="刪除課程" onClick={() => void deleteCourse(c)}><IconTrash size={16} /></button>
              <span onClick={() => setSelectedId(c.id)} style={{ cursor: 'pointer', color: 'var(--tx-muted)' }}><IconChevron size={16} /></span>
            </div>
          )}
        </SortableList>
      </div>
    </>
  )
}

function CourseDetail({ course, content, confirm, onBack }: {
  course: Course
  content: AdminContent
  confirm: Confirm
  onBack: () => void
}) {
  const [title, setTitle] = useState(course.title)
  const [tagline, setTagline] = useState(course.tagline)
  const [audience, setAudience] = useState<Audience>(course.audience)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save(patch: Partial<Course>) {
    setBusy(true); setErr(null)
    setErr(await content.updateCourse(course.id, patch))
    setBusy(false)
  }

  async function uploadCover(file: File) {
    setBusy(true); setErr(null)
    setErr(await content.uploadCourseCover(course.id, file))
    setBusy(false)
  }

  const chapters = content.chapters.filter(ch => ch.course_id === course.id).sort((a, b) => a.sort_no - b.sort_no)
  const rewards = content.rewards.filter(r => r.course_id === course.id)
  const cert = rewards.find(r => !r.after_chapter) ?? null
  const milestones = rewards.filter(r => r.after_chapter)

  async function addChapter() {
    setErr(await content.addChapter(course.id, chapters.at(-1)?.sort_no ?? 0))
  }

  function reorderChapters(newOrder: Chapter[]) {
    commitOrder(newOrder, (c, sortNo) => void content.updateChapter(c.key, { sort_no: sortNo }))
  }

  async function addCert() {
    setErr(await content.addReward(course.id, null))
  }

  async function addMilestone() {
    if (chapters.length === 0) return
    setErr(await content.addReward(course.id, chapters[0].key))
  }

  return (
    <div className="acard">
      <button className="curr-back" onClick={onBack}>
        <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><IconChevron size={14} /></span>回課程列表
      </button>

      <div className="curr-section">
        <div className="curr-section-hd"><h4>課程設定</h4></div>
        <div className="inline-form" style={{ marginTop: 0 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ minWidth: 220 }} placeholder="課名" />
          <input value={tagline} onChange={e => setTagline(e.target.value)} style={{ flex: 1, minWidth: 220 }} placeholder="一句話介紹" />
          <select value={audience} onChange={e => setAudience(e.target.value as Audience)}>
            <option value="public">公開・免費</option>
            <option value="member">會員課程</option>
            <option value="agent">代理專屬</option>
          </select>
          <button className="btn btn-s" disabled={busy} onClick={() => void save({ title, tagline, audience })}>存</button>
          <label className="btn-line" style={{ cursor: 'pointer' }}>
            {course.cover_url ? '換封面' : '＋放封面（橫圖）'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadCover(f) }} />
          </label>
          <button className="btn-line" disabled={busy} onClick={() => void save({ is_active: !course.is_active })}>
            {course.is_active ? '下架' : '重新上架'}
          </button>
        </div>
        {err && <p className="formerr">{err}</p>}
      </div>

      <div className="curr-section">
        <div className="curr-section-hd"><h4>章節（{chapters.length}）</h4></div>
        <SortableList items={chapters} getId={c => c.key} onReorder={reorderChapters}>
          {(ch, handle) => <ChapterCard chapter={ch} handle={handle} content={content} confirm={confirm} />}
        </SortableList>
        <p style={{ marginTop: 12 }}>
          <button className="btn-line" onClick={() => void addChapter()}>＋加一章</button>
        </p>
      </div>

      <div className="curr-section">
        <div className="curr-section-hd"><h4>里程碑與證書</h4></div>
        <p className="muted" style={{ fontSize: 13 }}>
          結業證書：全部章節（含測驗／作業）修完會拿到，一門課只有一筆。里程碑：選定的那一章修完就跳出來，可以加很多筆。
        </p>
        {cert && <RewardEditor reward={cert} chapters={chapters} content={content} confirm={confirm} isCert />}
        {!cert && (
          <p style={{ marginTop: 10 }}><button className="btn-line" onClick={() => void addCert()}>＋加結業證書文案</button></p>
        )}
        {milestones.map(r => (
          <RewardEditor key={r.id} reward={r} chapters={chapters} content={content} confirm={confirm} isCert={false} />
        ))}
        <p style={{ marginTop: 10 }}>
          <button className="btn-line" disabled={chapters.length === 0} onClick={() => void addMilestone()}>＋加章節里程碑</button>
        </p>
      </div>
    </div>
  )
}

function RewardEditor({ reward, chapters, content, confirm, isCert }: {
  reward: Reward
  chapters: Chapter[]
  content: AdminContent
  confirm: Confirm
  isCert: boolean
}) {
  const [title, setTitle] = useState(reward.title)
  const [message, setMessage] = useState(reward.message)
  const [afterChapter, setAfterChapter] = useState(reward.after_chapter ?? chapters[0]?.key ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setBusy(true); setSaved(false); setErr(null)
    const patch: Partial<Reward> = { title, message }
    if (!isCert) patch.after_chapter = afterChapter || null
    const e = await content.updateReward(reward.id, patch)
    setErr(e); setBusy(false)
    if (!e) setSaved(true)
  }

  async function del() {
    const ok = await confirm(`確定要刪除「${reward.title}」這筆${isCert ? '結業證書文案' : '里程碑'}？不能復原。`, { danger: true })
    if (!ok) return
    setErr(await content.deleteReward(reward.id))
  }

  return (
    <div style={{ background: '#FBF8EF', borderRadius: 12, padding: '12px 14px', marginTop: 10 }}>
      <div className="inline-form" style={{ marginTop: 0 }}>
        {!isCert && (
          <select value={afterChapter} onChange={e => setAfterChapter(e.target.value)}>
            {chapters.map((c, i) => <option key={c.key} value={c.key}>第 {i + 1} 章・{c.title}</option>)}
          </select>
        )}
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="標題" style={{ flex: 1, minWidth: 180 }} />
        <button className="btn btn-s" disabled={busy} onClick={() => void save()}>{saved ? <><IconCheck size={13} />存好了</> : '存'}</button>
        <button className="icon-btn danger" title="刪除" onClick={() => void del()}><IconTrash size={14} /></button>
      </div>
      <textarea className="note-ta" style={{ minHeight: 60 }} value={message} onChange={e => setMessage(e.target.value)}
        placeholder="給學員看的文案（選填）" />
      {err && <p className="formerr">{err}</p>}
    </div>
  )
}

function ChapterCard({ chapter, handle, content, confirm }: {
  chapter: Chapter
  handle: DragHandleProps
  content: AdminContent
  confirm: Confirm
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(chapter.title)
  const [tagline, setTagline] = useState(chapter.tagline)
  const [sections, setSections] = useState<Section[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    supabase.from('course_sections').select('*').eq('chapter_key', chapter.key).order('sort_no')
      .then(({ data }) => { if (alive) setSections((data as Section[] | null) ?? []) })
    return () => { alive = false }
  }, [open, chapter.key])

  const materials = content.materials.filter(m => m.chapter_key === chapter.key).sort((a, b) => a.sort_no - b.sort_no)
  const assessments = content.assessments.filter(a => a.chapter_key === chapter.key).sort((a, b) => a.sort_no - b.sort_no)

  async function save(patch: Partial<Chapter>) {
    setBusy(true); setErr(null)
    setErr(await content.updateChapter(chapter.key, patch))
    setBusy(false)
  }

  async function uploadChapterCover(file: File) {
    setBusy(true); setErr(null)
    setErr(await content.uploadChapterCover(chapter.key, file))
    setBusy(false)
  }

  async function uploadMaterial(file: File, kind: 'video' | 'doc') {
    setBusy(true); setErr(null)
    setErr(await content.uploadMaterial(chapter.key, file, kind, materials.at(-1)?.sort_no ?? 0))
    setBusy(false)
  }

  const [ytUrl, setYtUrl] = useState('')
  const [ytLabel, setYtLabel] = useState('')
  async function addYoutube() {
    setBusy(true); setErr(null)
    const e = await content.addYoutubeMaterial(chapter.key, ytUrl, ytLabel, materials.at(-1)?.sort_no ?? 0)
    setErr(e)
    if (!e) { setYtUrl(''); setYtLabel('') }
    setBusy(false)
  }

  async function addSection() {
    const { data, error } = await supabase.from('course_sections').insert({
      chapter_key: chapter.key, heading: '新小節',
      sort_no: (sections.at(-1)?.sort_no ?? 0) + 10,
    }).select().single()
    if (error) { setErr(error.message); return }
    setSections(ss => [...ss, data as Section])
  }

  function reorderMaterials(newOrder: Material[]) {
    commitOrder(newOrder, (m, sortNo) => void content.updateMaterial(m.id, { sort_no: sortNo }))
  }

  function reorderAssessments(newOrder: Assessment[]) {
    commitOrder(newOrder, (a, sortNo) => void content.updateAssessment(a.id, { sort_no: sortNo }))
  }

  async function addAssessment(kind: AssessmentKind) {
    setErr(await content.addAssessment(chapter.key, kind, assessments.at(-1)?.sort_no ?? 0))
  }

  async function deleteAssessment(a: Assessment) {
    const ok = await confirm(`確定要刪除「${a.title}」這份${a.kind === 'quiz' ? '測驗' : '作業'}？學員的作答／繳交紀錄會一起砍掉，不能復原。`, { danger: true })
    if (!ok) return
    setErr(await content.deleteAssessment(a.id))
  }

  function reorderSections(newOrder: Section[]) {
    setSections(newOrder)
    commitOrder(newOrder, (s, sortNo) => {
      void supabase.from('course_sections').update({ sort_no: sortNo }).eq('id', s.id)
    })
  }

  async function toggleSection(section: Section) {
    const { error } = await supabase.from('course_sections')
      .update({ is_active: !section.is_active }).eq('id', section.id)
    if (error) { setErr(error.message); return }
    setSections(ss => ss.map(s => s.id === section.id ? { ...s, is_active: !s.is_active } : s))
  }

  async function deleteSection(section: Section) {
    const ok = await confirm(`確定要刪除「${section.heading}」這段小節內文？不能復原。`, { danger: true })
    if (!ok) return
    const { error } = await supabase.from('course_sections').delete().eq('id', section.id)
    if (error) { setErr(error.message); return }
    setSections(ss => ss.filter(s => s.id !== section.id))
  }

  async function deleteChapter() {
    const ok = await confirm(`確定要刪除「${chapter.title}」這一章？裡面的教材會一起砍掉，不能復原。`, { danger: true })
    if (!ok) return
    setErr(await content.deleteChapter(chapter.key))
  }

  async function deleteMaterial(m: Material) {
    const ok = await confirm(`確定要刪除「${m.label}」？不能復原。`, { danger: true })
    if (!ok) return
    setErr(await content.deleteMaterial(m.id))
  }

  return (
    <div className="chapter-card">
      <div className="chapter-hd">
        <DragHandle {...handle} />
        <div className="grow" onClick={() => setOpen(o => !o)}>
          <b style={{ fontSize: 13.5 }}>{chapter.title}</b>
          <span className="sub">{materials.length} 份教材{chapter.is_active ? '' : '・已停用'}</span>
        </div>
        <button className="icon-btn danger" title="刪除章節" onClick={() => void deleteChapter()}><IconTrash size={15} /></button>
        <span onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', color: 'var(--tx-muted)' }}><IconChevron size={15} open={open} /></span>
      </div>
      {open && (
        <div className="chapter-body">
          <div className="inline-form">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="章名" />
            <input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="一句話副標" style={{ flex: 1, minWidth: 180 }} />
            <button className="btn btn-s" disabled={busy} onClick={() => void save({ title, tagline })}>存</button>
            <label className="btn-line" style={{ cursor: 'pointer' }}>
              {chapter.cover_url ? '換章節封面' : '＋章節封面'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadChapterCover(f) }} />
            </label>
            <button className="btn-line" disabled={busy} onClick={() => void save({ is_active: !chapter.is_active })}>
              {chapter.is_active ? '停用' : '啟用'}
            </button>
          </div>

          <SortableList items={sections} getId={s => String(s.id)} onReorder={reorderSections}>
            {(s, sHandle) => (
              <SectionEditor section={s} handle={sHandle}
                onToggle={() => void toggleSection(s)} onDelete={() => void deleteSection(s)} />
            )}
          </SortableList>

          <SortableList items={materials} getId={m => String(m.id)} onReorder={reorderMaterials}>
            {(m, mHandle) => (
              <MaterialAdminRow material={m} handle={mHandle}
                onToggle={() => content.toggleMaterial(m)}
                onRename={label => content.updateMaterial(m.id, { label })}
                onRenameYoutube={urlOrId => content.updateMaterialYoutubeId(m.id, urlOrId)}
                onDelete={() => void deleteMaterial(m)} />
            )}
          </SortableList>

          <div className="inline-form" style={{ marginTop: 10 }}>
            <button className="btn-line" onClick={() => void addSection()}>＋加小節內文</button>
            <label className="btn-line" style={{ cursor: 'pointer' }}>
              {busy ? '上傳中…' : '＋上傳影片'}
              <input type="file" accept="video/*" style={{ display: 'none' }} disabled={busy}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadMaterial(f, 'video') }} />
            </label>
            <label className="btn-line" style={{ cursor: 'pointer' }}>
              ＋上傳講義
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" style={{ display: 'none' }} disabled={busy}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadMaterial(f, 'doc') }} />
            </label>
          </div>
          <div className="inline-form" style={{ marginTop: 10 }}>
            <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="貼 YouTube 網址或影片 ID" style={{ minWidth: 220 }} />
            <input value={ytLabel} onChange={e => setYtLabel(e.target.value)} placeholder="這支影片的標題" style={{ flex: 1, minWidth: 180 }} />
            <button className="btn-line" disabled={busy || !ytUrl.trim()} onClick={() => void addYoutube()}>＋加 YouTube 影片</button>
          </div>
          {err && <p className="formerr">{err}</p>}

          <div className="curr-section-hd" style={{ marginTop: 20 }}><h4>測驗／作業（{assessments.length}）</h4></div>
          <SortableList items={assessments} getId={a => String(a.id)} onReorder={reorderAssessments}>
            {(a, aHandle) => (
              <AssessmentEditor assessment={a} handle={aHandle} content={content} confirm={confirm}
                onDelete={() => void deleteAssessment(a)} />
            )}
          </SortableList>
          <div className="inline-form" style={{ marginTop: 10 }}>
            <button className="btn-line" onClick={() => void addAssessment('quiz')}>＋加測驗</button>
            <button className="btn-line" onClick={() => void addAssessment('assignment')}>＋加作業</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── 測驗／作業編輯 ───────────────────────── */

function AssessmentEditor({ assessment, handle, content, confirm, onDelete }: {
  assessment: Assessment
  handle: DragHandleProps
  content: AdminContent
  confirm: Confirm
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(assessment.title)
  const [instructions, setInstructions] = useState(assessment.instructions)
  const [passPct, setPassPct] = useState(assessment.pass_pct)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setBusy(true); setSaved(false); setErr(null)
    const patch: Partial<Assessment> = { title, instructions }
    if (assessment.kind === 'quiz') patch.pass_pct = passPct
    const e = await content.updateAssessment(assessment.id, patch)
    setErr(e); setBusy(false)
    if (!e) setSaved(true)
  }

  async function toggleActive() {
    setErr(await content.updateAssessment(assessment.id, { is_active: !assessment.is_active }))
  }

  return (
    <div className="chapter-card" style={{ marginTop: 10 }}>
      <div className="chapter-hd">
        <DragHandle {...handle} />
        <span className={`kindchip ${assessment.kind}`}>{assessment.kind === 'quiz' ? '測驗' : '作業'}</span>
        <div className="grow" onClick={() => setOpen(o => !o)}>
          <b style={{ fontSize: 13.5 }}>{assessment.title}</b>
          <span className="sub">
            {assessment.is_active ? '' : '已停用・'}
            {assessment.kind === 'quiz' ? `答對 ${assessment.pass_pct}% 算過` : '學員上傳・管理員手動審核'}
          </span>
        </div>
        <button className="icon-btn danger" title="刪除" onClick={onDelete}><IconTrash size={15} /></button>
        <span onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', color: 'var(--tx-muted)' }}><IconChevron size={15} open={open} /></span>
      </div>
      {open && (
        <div className="chapter-body">
          <div className="inline-form" style={{ marginTop: 0 }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="標題" style={{ flex: 1, minWidth: 200 }} />
            {assessment.kind === 'quiz' && (
              <span className="i" style={{ fontSize: 13, gap: 6, display: 'inline-flex', alignItems: 'center' }}>
                及格
                <input type="number" min={0} max={100} value={passPct}
                  onChange={e => setPassPct(Number(e.target.value))} style={{ width: 64 }} />
                %
              </span>
            )}
            <button className="btn btn-s" disabled={busy} onClick={() => void save()}>{saved ? <><IconCheck size={13} />存好了</> : '存'}</button>
            <button className="btn-line" onClick={() => void toggleActive()}>{assessment.is_active ? '停用' : '啟用'}</button>
          </div>
          <textarea className="note-ta" style={{ minHeight: 60 }} value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder={assessment.kind === 'quiz' ? '測驗說明（選填）' : '作業說明——要交什麼、格式、注意事項'} />
          {err && <p className="formerr">{err}</p>}
          {assessment.kind === 'quiz' && <QuizQuestionEditor assessmentId={assessment.id} confirm={confirm} />}
        </div>
      )}
    </div>
  )
}

function QuizQuestionEditor({ assessmentId, confirm }: { assessmentId: number; confirm: Confirm }) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    supabase.from('quiz_questions').select('*').eq('assessment_id', assessmentId).order('sort_no').order('id')
      .then(({ data }) => { if (alive) { setQuestions((data as QuizQuestion[] | null) ?? []); setLoaded(true) } })
    return () => { alive = false }
  }, [assessmentId])

  async function addQuestion() {
    const { data, error } = await supabase.from('quiz_questions').insert({
      assessment_id: assessmentId, question: '新題目', options: ['選項一', '選項二'], correct_index: 0,
      sort_no: (questions.at(-1)?.sort_no ?? 0) + 10,
    }).select().single()
    if (error) { setErr(error.message); return }
    setQuestions(qs => [...qs, data as QuizQuestion])
  }

  function reorder(newOrder: QuizQuestion[]) {
    setQuestions(newOrder)
    commitOrder(newOrder, (q, sortNo) => { void supabase.from('quiz_questions').update({ sort_no: sortNo }).eq('id', q.id) })
  }

  async function deleteQuestion(q: QuizQuestion) {
    const ok = await confirm('確定要刪除這一題？不能復原。', { danger: true })
    if (!ok) return
    const { error } = await supabase.from('quiz_questions').delete().eq('id', q.id)
    if (error) { setErr(error.message); return }
    setQuestions(qs => qs.filter(x => x.id !== q.id))
  }

  function patchLocal(id: number, patch: Partial<QuizQuestion>) {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...patch } : q))
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="curr-section-hd"><h4>題目（{questions.length}）</h4></div>
      {!loaded && <div className="skel" />}
      {loaded && questions.length === 0 && <p className="muted" style={{ fontSize: 13 }}>還沒有題目，點下面加一題。</p>}
      <SortableList items={questions} getId={q => String(q.id)} onReorder={reorder}>
        {(q, qHandle) => (
          <QuestionRow question={q} handle={qHandle} onPatch={patchLocal} onDelete={() => void deleteQuestion(q)} />
        )}
      </SortableList>
      <p style={{ marginTop: 10 }}><button className="btn-line" onClick={() => void addQuestion()}>＋加一題</button></p>
      {err && <p className="formerr">{err}</p>}
    </div>
  )
}

function QuestionRow({ question, handle, onPatch, onDelete }: {
  question: QuizQuestion
  handle: DragHandleProps
  onPatch: (id: number, patch: Partial<QuizQuestion>) => void
  onDelete: () => void
}) {
  const [text, setText] = useState(question.question)
  const [options, setOptions] = useState(question.options)
  const [correct, setCorrect] = useState(question.correct_index)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setBusy(true); setSaved(false); setErr(null)
    const cleanOptions = options.map(o => o.trim()).filter(Boolean)
    if (cleanOptions.length < 2) { setErr('至少要有兩個選項'); setBusy(false); return }
    const fixedCorrect = Math.min(correct, cleanOptions.length - 1)
    const { error } = await supabase.from('quiz_questions')
      .update({ question: text, options: cleanOptions, correct_index: fixedCorrect }).eq('id', question.id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setOptions(cleanOptions); setCorrect(fixedCorrect); setSaved(true)
    onPatch(question.id, { question: text, options: cleanOptions, correct_index: fixedCorrect })
  }

  function updateOption(i: number, v: string) {
    setOptions(os => os.map((o, idx) => idx === i ? v : o))
  }
  function addOption() {
    setOptions(os => [...os, ''])
  }
  function removeOption(i: number) {
    setOptions(os => os.filter((_, idx) => idx !== i))
    setCorrect(c => (c === i ? 0 : c > i ? c - 1 : c))
  }

  return (
    <div style={{ background: '#FBF8EF', borderRadius: 12, padding: '12px 14px', marginTop: 10 }}>
      <div className="inline-form" style={{ marginTop: 0 }}>
        <DragHandle {...handle} />
        <input value={text} onChange={e => setText(e.target.value)} placeholder="題目" style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn-s" disabled={busy} onClick={() => void save()}>{saved ? <><IconCheck size={13} />存好了</> : '存'}</button>
        <button className="icon-btn danger" title="刪除這題" onClick={onDelete}><IconTrash size={14} /></button>
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name={`correct-${question.id}`} checked={correct === i}
              onChange={() => setCorrect(i)} title="標成正確答案" />
            <input value={opt} onChange={e => updateOption(i, e.target.value)} placeholder={`選項 ${i + 1}`}
              style={{ flex: 1, border: '1px solid rgba(197,179,130,.55)', borderRadius: 10, padding: '7px 10px', font: 'inherit', fontSize: 13, background: '#FFFDF7' }} />
            {options.length > 2 && (
              <button className="icon-btn danger" title="刪除選項" onClick={() => removeOption(i)}><IconTrash size={13} /></button>
            )}
          </div>
        ))}
      </div>
      <button className="btn-line" style={{ marginTop: 8 }} onClick={addOption}>＋加選項</button>
      <p style={{ marginTop: 4, fontSize: 11.5, color: 'var(--tx-muted)' }}>圈選左邊的圓點標記正確答案</p>
      {err && <p className="formerr">{err}</p>}
    </div>
  )
}

function SectionEditor({ section, handle, onToggle, onDelete }: {
  section: Section
  handle: DragHandleProps
  onToggle: () => void
  onDelete: () => void
}) {
  const [heading, setHeading] = useState(section.heading)
  const [items, setItems] = useState(section.items.join('\n'))
  const [note, setNote] = useState(section.note ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setBusy(true); setSaved(false)
    await supabase.from('course_sections').update({
      heading, note: note || null,
      items: items.split('\n').map(s => s.trim()).filter(Boolean),
    }).eq('id', section.id)
    setBusy(false); setSaved(true)
  }

  return (
    <div style={{ background: '#FBF8EF', borderRadius: 12, padding: '12px 14px', marginTop: 10 }}>
      <div className="inline-form" style={{ marginTop: 0 }}>
        <DragHandle {...handle} />
        <input value={heading} onChange={e => setHeading(e.target.value)} placeholder="小節標題" style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn-s" disabled={busy} onClick={() => void save()}>{saved ? <><IconCheck size={13} />存好了</> : '存'}</button>
        <button className="btn-line" onClick={onToggle}>{section.is_active ? '停用' : '啟用'}</button>
        <button className="icon-btn danger" title="刪除小節內文" onClick={onDelete}><IconTrash size={14} /></button>
      </div>
      {!section.is_active && <p className="sub" style={{ marginTop: 6 }}>已停用——學員看不到</p>}
      <textarea className="note-ta" style={{ minHeight: 70 }} value={items} onChange={e => setItems(e.target.value)}
        placeholder={'條列重點——一行一點'} />
      <input style={{ width: '100%', border: '1px solid rgba(197,179,130,.55)', borderRadius: 10, padding: '9px 12px', font: 'inherit', fontSize: 13.5, background: '#FFFDF7', marginTop: 8 }}
        value={note} onChange={e => setNote(e.target.value)} placeholder="講師提醒（一句，可留空）" />
    </div>
  )
}

function MaterialAdminRow({ material, handle, onToggle, onRename, onRenameYoutube, onDelete }: {
  material: Material
  handle: DragHandleProps
  onToggle: () => Promise<string | null>
  onRename: (label: string) => Promise<string | null>
  onRenameYoutube: (urlOrId: string) => Promise<string | null>
  onDelete: () => void
}) {
  const [label, setLabel] = useState(material.label)
  const [ytId, setYtId] = useState(material.youtube_id ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const labelDirty = label.trim() !== '' && label.trim() !== material.label
  const ytDirty = ytId.trim() !== '' && ytId.trim() !== material.youtube_id

  async function toggle() {
    setBusy(true)
    await onToggle()
    setBusy(false)
  }

  async function rename() {
    setBusy(true); setErr(null)
    setErr(await onRename(label.trim()))
    setBusy(false)
  }

  async function renameYoutube() {
    setBusy(true); setErr(null)
    const e = await onRenameYoutube(ytId.trim())
    setErr(e)
    setBusy(false)
  }

  return (
    <div className="mat-row" style={{ flexWrap: 'wrap' }}>
      <DragHandle {...handle} />
      <span style={{ flex: 'none', color: 'var(--tx-muted)' }}>
        {material.kind === 'video' ? <IconFilm size={14} /> : <IconFileText size={14} />}
      </span>
      <input value={label} onChange={e => setLabel(e.target.value)} placeholder="教材名稱"
        style={{ flex: 1, minWidth: 140, border: '1px solid rgba(197,179,130,.4)', borderRadius: 8, padding: '6px 10px', font: 'inherit', fontSize: 13, background: '#FFFDF7' }} />
      {labelDirty && <button className="btn btn-s" disabled={busy} onClick={() => void rename()}>存</button>}
      {!material.is_active && <span className="sub" style={{ flex: 'none' }}>已停用——學員看不到</span>}
      <button className="btn-line" disabled={busy} onClick={() => void toggle()}>
        {material.is_active ? '停用' : '啟用'}
      </button>
      <button className="icon-btn danger" disabled={busy} title="刪除教材" onClick={onDelete}><IconTrash size={14} /></button>
      {material.youtube_id && (
        <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center', marginLeft: 24 }}>
          <span className="sub" style={{ flex: 'none' }}>YouTube 網址</span>
          <input value={ytId} onChange={e => setYtId(e.target.value)} placeholder="貼新的 YouTube 網址或影片 ID"
            style={{ flex: 1, minWidth: 140, border: '1px solid rgba(197,179,130,.4)', borderRadius: 8, padding: '5px 10px', font: 'inherit', fontSize: 12.5, background: '#FFFDF7' }} />
          {ytDirty && <button className="btn btn-s" disabled={busy} onClick={() => void renameYoutube()}>存</button>}
        </div>
      )}
      {err && <p className="formerr" style={{ width: '100%', margin: 0 }}>{err}</p>}
    </div>
  )
}

/* ───────────────────────── 作業批改 ───────────────────────── */

function GradingTab() {
  const content = useAdminContent()
  const members = useAdminMembers()
  const subs = useAdminSubmissions()
  const [showAll, setShowAll] = useState(false)

  const assignments = content.assessments.filter(a => a.kind === 'assignment')
  const assignmentIds = new Set(assignments.map(a => a.id))
  const rows = subs.rows
    .filter(r => assignmentIds.has(r.assessment_id))
    .filter(r => showAll || r.status === 'pending')

  const loaded = content.loaded && members.loaded && subs.loaded

  return (
    <div className="acard">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h3 style={{ flex: 1 }}>作業批改</h3>
        <label className="i" style={{ fontSize: 13, gap: 6, display: 'inline-flex', alignItems: 'center', color: 'var(--tx-muted)' }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          顯示已批改的
        </label>
      </div>
      {!loaded && <div className="skel" />}
      {loaded && rows.length === 0 && (
        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          {showAll ? '還沒有任何作業繳交紀錄。' : '目前沒有待審核的作業——都批完了。'}
        </p>
      )}
      {rows.map(r => {
        const assessment = assignments.find(a => a.id === r.assessment_id)
        const chapter = assessment ? content.chapters.find(c => c.key === assessment.chapter_key) : null
        const course = chapter ? content.courses.find(c => c.id === chapter.course_id) : null
        const member = members.rows.find(p => p.user_id === r.user_id)
        return (
          <SubmissionRow key={`${r.user_id}:${r.assessment_id}`} submission={r}
            title={assessment?.title ?? '（測驗／作業已刪除）'}
            path={course ? `${course.title} ‹ ${chapter?.title ?? ''}` : ''}
            memberLabel={member ? `${member.name || '（沒填名字）'}・${member.email}` : r.user_id}
            fileUrl={subs.fileUrl} busy={subs.busyKey === `${r.user_id}:${r.assessment_id}`}
            onGrade={(status, feedback) => subs.grade(r.user_id, r.assessment_id, status, feedback)} />
        )
      })}
    </div>
  )
}

function SubmissionRow({ submission, title, path, memberLabel, fileUrl, busy, onGrade }: {
  submission: AssessmentSubmission
  title: string
  path: string
  memberLabel: string
  fileUrl: (path: string) => Promise<string | null>
  busy: boolean
  onGrade: (status: 'passed' | 'failed', feedback: string) => Promise<string | null>
}) {
  const [feedback, setFeedback] = useState(submission.feedback ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)

  async function openFile() {
    if (!submission.file_path) return
    setSigning(true)
    const url = await fileUrl(submission.file_path)
    setSigning(false)
    if (url) window.open(url, '_blank', 'noopener')
    else setErr('檔案連結產生失敗，再試一次')
  }

  async function grade(status: 'passed' | 'failed') {
    setErr(await onGrade(status, feedback))
  }

  const statusLabel = submission.status === 'pending' ? '待審核' : submission.status === 'passed' ? '通過' : '退回'

  return (
    <div className="arow" style={{ alignItems: 'flex-start' }}>
      <div className="grow">
        <b>{title}</b>
        <span className="sub">{path}・{memberLabel}</span>
        <span className="sub">{new Date(submission.submitted_at).toLocaleString('zh-TW')} 繳交・{statusLabel}</span>
        {submission.note && <p style={{ fontSize: 13, marginTop: 6, color: 'var(--tx-soft)' }}>{submission.note}</p>}
        <div className="inline-form" style={{ marginTop: 8 }}>
          {submission.file_path && (
            <button className="btn-line" disabled={signing} onClick={() => void openFile()}>
              {signing ? '產生連結中…' : '查看繳交檔案'}
            </button>
          )}
        </div>
        <textarea className="note-ta" style={{ minHeight: 50, marginTop: 8 }} value={feedback}
          onChange={e => setFeedback(e.target.value)} placeholder="給學員的評語（選填）" />
        {err && <p className="formerr">{err}</p>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn btn-s" disabled={busy} onClick={() => void grade('passed')}>通過</button>
        <button className="btn-line" disabled={busy} onClick={() => void grade('failed')}>退回</button>
      </div>
    </div>
  )
}

/* ───────────────────────── 垃圾桶 ───────────────────────── */

function TrashTab() {
  const trash = useAdminTrash()
  const confirm = useConfirm()
  const [err, setErr] = useState<string | null>(null)

  const total = trash.courses.length + trash.chapters.length + trash.materials.length + trash.assessments.length

  async function purge(label: string, fn: () => Promise<string | null>) {
    const ok = await confirm(`永久刪除「${label}」？垃圾桶清掉之後真的救不回來了。`, { danger: true })
    if (!ok) return
    setErr(await fn())
  }

  return (
    <div className="acard">
      <h3>垃圾桶{trash.loaded ? `（${total}）` : ''}</h3>
      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        後台刪除都是先進垃圾桶，不是馬上真的沒了——點「還原」救回來，或「永久刪除」才是真的清掉。
      </p>
      {!trash.loaded && <div className="skel" style={{ marginTop: 16 }} />}
      {trash.loaded && total === 0 && (
        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>垃圾桶是空的。</p>
      )}
      {err && <p className="formerr">{err}</p>}

      {trash.courses.length > 0 && (
        <>
          <div className="curr-section-hd" style={{ marginTop: 18 }}><h4>課程（{trash.courses.length}）</h4></div>
          {trash.courses.map(c => (
            <div className="arow" key={c.id}>
              <div className="grow">
                <b>{c.title}</b>
                <span className="sub">刪除於 {new Date(c.deleted_at ?? '').toLocaleString('zh-TW')}</span>
              </div>
              <button className="btn-line" onClick={() => void trash.restoreCourse(c.id).then(e => setErr(e))}>還原</button>
              <button className="icon-btn danger" title="永久刪除"
                onClick={() => void purge(c.title, () => trash.purgeCourse(c.id))}><IconTrash size={15} /></button>
            </div>
          ))}
        </>
      )}

      {trash.chapters.length > 0 && (
        <>
          <div className="curr-section-hd" style={{ marginTop: 18 }}><h4>章節（{trash.chapters.length}）</h4></div>
          {trash.chapters.map(c => (
            <div className="arow" key={c.key}>
              <div className="grow">
                <b>{c.title}</b>
                <span className="sub">{c.courseTitle}・刪除於 {new Date(c.deleted_at ?? '').toLocaleString('zh-TW')}</span>
              </div>
              <button className="btn-line" onClick={() => void trash.restoreChapter(c.key).then(e => setErr(e))}>還原</button>
              <button className="icon-btn danger" title="永久刪除"
                onClick={() => void purge(c.title, () => trash.purgeChapter(c.key))}><IconTrash size={15} /></button>
            </div>
          ))}
        </>
      )}

      {trash.materials.length > 0 && (
        <>
          <div className="curr-section-hd" style={{ marginTop: 18 }}><h4>教材（{trash.materials.length}）</h4></div>
          {trash.materials.map(m => (
            <div className="arow" key={m.id}>
              <div className="grow">
                <b>{m.label}</b>
                <span className="sub">{m.courseTitle} ‹ {m.chapterTitle}・刪除於 {new Date(m.deleted_at ?? '').toLocaleString('zh-TW')}</span>
              </div>
              <button className="btn-line" onClick={() => void trash.restoreMaterial(m.id).then(e => setErr(e))}>還原</button>
              <button className="icon-btn danger" title="永久刪除"
                onClick={() => void purge(m.label, () => trash.purgeMaterial(m.id))}><IconTrash size={15} /></button>
            </div>
          ))}
        </>
      )}

      {trash.assessments.length > 0 && (
        <>
          <div className="curr-section-hd" style={{ marginTop: 18 }}><h4>測驗／作業（{trash.assessments.length}）</h4></div>
          {trash.assessments.map(a => (
            <div className="arow" key={a.id}>
              <div className="grow">
                <b>{a.title}</b>
                <span className="sub">{a.courseTitle} ‹ {a.chapterTitle}・刪除於 {new Date(a.deleted_at ?? '').toLocaleString('zh-TW')}</span>
              </div>
              <button className="btn-line" onClick={() => void trash.restoreAssessment(a.id).then(e => setErr(e))}>還原</button>
              <button className="icon-btn danger" title="永久刪除"
                onClick={() => void purge(a.title, () => trash.purgeAssessment(a.id))}><IconTrash size={15} /></button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
