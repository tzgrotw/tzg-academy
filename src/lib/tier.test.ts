import { describe, expect, it } from 'vitest'
import { canAccess, currentPrice, lockHint, splitOrder, type CourseGate } from './tier'
import type { Audience } from './types'

const free = (audience: Audience): CourseGate => ({ audience, price_twd: 0 })
const paid = (price = 3600): CourseGate => ({ audience: 'public', price_twd: price })

describe('canAccess', () => {
  it('public course is open to everyone, including logged-out visitors', () => {
    expect(canAccess(free('public'), null)).toBe(true)
    expect(canAccess(free('public'), 'member')).toBe(true)
    expect(canAccess(free('public'), 'agent')).toBe(true)
  })

  it('member course requires at least member tier', () => {
    expect(canAccess(free('member'), null)).toBe(false)
    expect(canAccess(free('member'), 'member')).toBe(true)
    expect(canAccess(free('member'), 'agent')).toBe(true)
  })

  it('agent course requires agent tier specifically, not just member', () => {
    expect(canAccess(free('agent'), null)).toBe(false)
    expect(canAccess(free('agent'), 'member')).toBe(false)
    expect(canAccess(free('agent'), 'agent')).toBe(true)
  })

  it('admin can access everything regardless of course audience', () => {
    expect(canAccess(free('public'), 'admin')).toBe(true)
    expect(canAccess(free('member'), 'admin')).toBe(true)
    expect(canAccess(free('agent'), 'admin')).toBe(true)
  })

  it('paid course requires a purchase — tier alone is not enough', () => {
    expect(canAccess(paid(), 'member', false)).toBe(false)
    expect(canAccess(paid(), 'agent', false)).toBe(false)
    expect(canAccess(paid(), null, false)).toBe(false)
    expect(canAccess(paid(), 'member', true)).toBe(true)
    expect(canAccess(paid(), null, true)).toBe(true)
  })

  it('admin sees paid courses without purchasing', () => {
    expect(canAccess(paid(), 'admin', false)).toBe(true)
  })
})

describe('lockHint', () => {
  it('tells a logged-out visitor to register, regardless of audience', () => {
    expect(lockHint(free('member'), null)).toBe('免費註冊就能開始上課')
    expect(lockHint(free('agent'), null)).toBe('免費註冊就能開始上課')
  })

  it('tells a logged-in non-member to contact the academy for a member course', () => {
    expect(lockHint(free('member'), 'member')).toContain('會員')
  })

  it('tells a logged-in non-agent to contact the academy for an agent course', () => {
    expect(lockHint(free('agent'), 'member')).toContain('代理')
  })

  it('tells everyone to purchase for a paid course', () => {
    expect(lockHint(paid(), null)).toContain('註冊')
    expect(lockHint(paid(), 'member')).toContain('購')
  })
})

describe('currentPrice', () => {
  const base = { price_twd: 3600, early_price_twd: 2800, early_until: '2026-09-01T00:00:00Z' }

  it('uses early-bird price before the deadline', () => {
    expect(currentPrice(base, new Date('2026-08-15T00:00:00Z'))).toBe(2800)
  })

  it('falls back to list price after the deadline', () => {
    expect(currentPrice(base, new Date('2026-09-02T00:00:00Z'))).toBe(3600)
  })

  it('uses list price when no early-bird is set', () => {
    expect(currentPrice({ price_twd: 3600, early_price_twd: null, early_until: null })).toBe(3600)
  })
})

describe('splitOrder', () => {
  it('splits 90/10 with no referrer', () => {
    expect(splitOrder(1000, 90, 10, false)).toEqual({ instructor: 900, referrer: 0, platform: 100 })
  })

  it('referral cut comes out of the instructor share: 80/10/10', () => {
    expect(splitOrder(1000, 90, 10, true)).toEqual({ instructor: 800, referrer: 100, platform: 100 })
  })

  it('always sums back to the order amount, remainder goes to platform', () => {
    const s = splitOrder(999, 90, 10, true)
    expect(s.instructor + s.referrer + s.platform).toBe(999)
    expect(s.instructor).toBe(799) // floor(999*0.8)
    expect(s.referrer).toBe(99) // floor(999*0.1)
    expect(s.platform).toBe(101)
  })

  it('never gives the instructor a negative share', () => {
    const s = splitOrder(1000, 5, 10, true)
    expect(s.instructor).toBe(0)
    expect(s.instructor + s.referrer + s.platform).toBe(1000)
  })

  it('zero-amount order splits to all zeros', () => {
    expect(splitOrder(0, 90, 10, true)).toEqual({ instructor: 0, referrer: 0, platform: 0 })
  })
})
