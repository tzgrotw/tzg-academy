import type { Audience, Course, Tier } from './types'

/** canAccess 只需要課程的這三欄——傳整個 Course 或造個小物件都行 */
export type CourseGate = Pick<Course, 'audience' | 'price_twd'>

// 「這個人能不能看這門課的內容」——前端只有這一份；資料庫那份在
// schema.sql 的 fn_can_access_course（RLS 是真正的門，這裡是畫面提示用）。
// 規則跟資料庫一字不差：付費課（price_twd>0）＝買了才開；免費課走 audience 分級。
export function canAccess(course: CourseGate, tier: Tier | null, hasPurchased = false): boolean {
  if (tier === 'admin') return true
  if (course.price_twd > 0) return hasPurchased
  if (course.audience === 'public') return true
  if (course.audience === 'member') return tier === 'member' || tier === 'agent'
  return tier === 'agent'
}

export const AUDIENCE_LABEL: Record<Audience, string> = {
  public: '公開・免費',
  member: '會員課程',
  agent: '代理專屬',
}

export const TIER_LABEL: Record<Tier, string> = {
  member: '會員',
  agent: '代理',
  admin: '管理員',
}

/** 看不到內容時，畫面該說哪一句（唯一下一步） */
export function lockHint(course: CourseGate, tier: Tier | null): string {
  if (course.price_twd > 0) {
    return tier === null ? '免費註冊後就能購買這門課' : '這門課需要購課——完成購買立即解鎖'
  }
  if (tier === null) return '免費註冊就能開始上課'
  if (course.audience === 'member') return '聯繫學院開通會員身分，整套進階課一次打開'
  return '這門課是代理專屬——想加入代理，跟學院聊聊'
}

/** 現在該收多少：早鳥價還沒過期就用早鳥價，否則定價 */
export function currentPrice(
  course: Pick<Course, 'price_twd' | 'early_price_twd' | 'early_until'>,
  now: Date = new Date(),
): number {
  if (course.early_price_twd != null && course.early_until && new Date(course.early_until) > now) {
    return course.early_price_twd
  }
  return course.price_twd
}

export interface OrderSplit {
  instructor: number
  referrer: number
  platform: number
}

/** 三方拆帳——下單當下算好存進訂單（改比例不影響舊帳）。
 *  推薦獎金從講師份額出；講師與推薦人的份額無條件捨去，尾差歸平台，
 *  所以三個數字加起來永遠等於訂單金額，對帳不會差一塊錢。 */
export function splitOrder(
  amountTwd: number, revenueSharePct: number, referralCutPct: number, hasReferrer: boolean,
): OrderSplit {
  const instructorPct = Math.max(0, hasReferrer ? revenueSharePct - referralCutPct : revenueSharePct)
  const instructor = Math.floor(amountTwd * instructorPct / 100)
  const referrer = hasReferrer ? Math.floor(amountTwd * referralCutPct / 100) : 0
  return { instructor, referrer, platform: amountTwd - instructor - referrer }
}
