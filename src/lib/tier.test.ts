import { describe, expect, it } from 'vitest'
import { canAccess, lockHint } from './tier'

describe('canAccess', () => {
  it('public course is open to everyone, including logged-out visitors', () => {
    expect(canAccess('public', null)).toBe(true)
    expect(canAccess('public', 'member')).toBe(true)
    expect(canAccess('public', 'agent')).toBe(true)
  })

  it('member course requires at least member tier', () => {
    expect(canAccess('member', null)).toBe(false)
    expect(canAccess('member', 'member')).toBe(true)
    expect(canAccess('member', 'agent')).toBe(true)
  })

  it('agent course requires agent tier specifically, not just member', () => {
    expect(canAccess('agent', null)).toBe(false)
    expect(canAccess('agent', 'member')).toBe(false)
    expect(canAccess('agent', 'agent')).toBe(true)
  })

  it('admin can access everything regardless of course audience', () => {
    expect(canAccess('public', 'admin')).toBe(true)
    expect(canAccess('member', 'admin')).toBe(true)
    expect(canAccess('agent', 'admin')).toBe(true)
  })
})

describe('lockHint', () => {
  it('tells a logged-out visitor to register, regardless of audience', () => {
    expect(lockHint('member', null)).toBe('免費註冊就能開始上課')
    expect(lockHint('agent', null)).toBe('免費註冊就能開始上課')
  })

  it('tells a logged-in non-member to contact the academy for a member course', () => {
    expect(lockHint('member', 'member')).toContain('會員')
  })

  it('tells a logged-in non-agent to contact the academy for an agent course', () => {
    expect(lockHint('agent', 'member')).toContain('代理')
  })
})
