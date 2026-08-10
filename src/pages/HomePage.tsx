import { Link } from 'react-router-dom'
import { Page } from '../components/Shell'
import { CourseCard } from '../components/CourseCard'
import { IconPhone, IconBookmark, IconCrown } from '../components/icons'
import { useCatalog } from '../hooks/useCatalog'
import { useAuth } from '../hooks/useAuth'
import heroImg from '../assets/hero.jpg'

// 首頁＝招生門面（老闆 2026-08-05 定稿的提案）：超大標題講定位——
// 女性創業與自我成長；課程只放前四張卡當櫥窗，選課的家在 /courses。
export function HomePage() {
  const { userId } = useAuth()
  const cat = useCatalog()
  const featured = cat.courses.filter(c => c.is_active).slice(0, 4)

  return (
    <Page>
      <header className="hero">
        <img className="bg" src={heroImg} alt="" />
        <div className="veil" />
        <div className="wrap in">
          <p className="eyebrow">泰 熙 爾 札 娜 ・ 學 院</p>
          <h1 className="serif">女性創業，<br />更愛自己</h1>
          <p className="sub">創業、自我成長、理財、自媒體、直播、珠寶——給想要獨立的妳，一間隨時開門的線上學院。手機就能上課，看到哪成長到那。</p>
          <div className="cta">
            <Link className="btn btn-m" to={userId ? '/courses' : '/register'}>免費開始上課</Link>
            <Link className="btn btn-ghost" to="/courses">看全部課程</Link>
          </div>
          <p className="note">公開課註冊就能看・免費註冊</p>
        </div>
      </header>

      <div className="wrap sect">
        <p className="eyebrow">COURSES</p>
        <h2 className="serif">課程</h2>
        <p className="lead">從珠寶知識到AI技巧——公開課免費看，進階課入會解鎖。每一門都有章節進度、里程碑獎勵、修畢證書。</p>
        {!cat.loaded && <div className="skel" />}
        {cat.loaded && featured.length === 0 && (
          <p className="muted" style={{ marginTop: 24 }}>課程準備中——先註冊卡個位。</p>
        )}
        <div className="grid">
          {featured.map(c => {
            const { chapterCount, videoCount } = cat.courseStats(c.id)
            return <CourseCard key={c.id} course={c} chapterCount={chapterCount} videoCount={videoCount} />
          })}
        </div>
        {cat.loaded && cat.courses.filter(c => c.is_active).length > 4 && (
          <p style={{ marginTop: 22 }}>
            <Link to="/courses" style={{ color: 'var(--magenta)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              看全部 {cat.courses.filter(c => c.is_active).length} 門課程 →
            </Link>
          </p>
        )}
      </div>

      <div className="wrap sect">
        <p className="eyebrow">WHY US</p>
        <h2 className="serif">在這裡上課的樣子</h2>
        <div className="feat">
          <div><div className="ico"><IconPhone /></div><h3>孩子睡了再上課也行</h3><p>手機一次點擊進全螢幕、轉橫向不中斷——通勤、午休、哄睡之後，都是妳的上課時間。</p></div>
          <div><div className="ico"><IconBookmark /></div><h3>看到哪，記到哪</h3><p>每支影片自動記進度，下次打開從上次的地方接著播，永遠知道下一步該看哪支。</p></div>
          <div><div className="ico"><IconCrown /></div><h3>學姊帶妳一起走</h3><p>章節里程碑一路點亮、修畢發證書；走過同一條路的學姊們，就在社群裡等妳。</p></div>
        </div>
      </div>

      <div className="wrap"><div className="band">
        <div>
          <h2 className="serif">想把日子過成自己的？<br />進階課程，入會解鎖</h2>
          <p>自媒體、直播、珠寶、理財——註冊後聯繫學院開通會員身分，整套進階課一次打開，開始經營妳自己的事業。</p>
        </div>
        <div className="right"><Link className="btn btn-m" to={userId ? '/courses' : '/register'}>{userId ? '看全部課程' : '免費註冊'}</Link></div>
      </div></div>
    </Page>
  )
}
