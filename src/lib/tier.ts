import type { Audience, Tier } from './types'

// 「這個人能不能看這門課的內容」——前端只有這一份；資料庫那份在
// schema.sql 的 fn_can_access_course（RLS 是真正的門，這裡是畫面提示用）
export function canAccess(audience: Audience, tier: Tier | null): boolean {
  if (audience === 'public') return true
  if (tier === 'admin') return true
  if (audience === 'member') return tier === 'member' || tier === 'agent'
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
export function lockHint(audience: Audience, tier: Tier | null): string {
  if (tier === null) return '免費註冊就能開始上課'
  if (audience === 'member') return '聯繫學院開通會員身分，整套進階課一次打開'
  return '這門課是代理專屬——想加入代理，跟學院聊聊'
}
