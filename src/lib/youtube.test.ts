import { describe, expect, it } from 'vitest'
import { extractYoutubeId } from './youtube'

describe('extractYoutubeId', () => {
  it('accepts a raw 11-char id', () => {
    expect(extractYoutubeId('wGigUFDfpxQ')).toBe('wGigUFDfpxQ')
  })

  it('trims surrounding whitespace off a raw id', () => {
    expect(extractYoutubeId('  wGigUFDfpxQ  ')).toBe('wGigUFDfpxQ')
  })

  it('extracts from a watch url', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=wGigUFDfpxQ')).toBe('wGigUFDfpxQ')
  })

  it('extracts from a watch url with extra query params', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=wGigUFDfpxQ&t=42s')).toBe('wGigUFDfpxQ')
  })

  it('extracts from a youtu.be short link', () => {
    expect(extractYoutubeId('https://youtu.be/wGigUFDfpxQ')).toBe('wGigUFDfpxQ')
  })

  it('extracts from an embed url', () => {
    expect(extractYoutubeId('https://www.youtube-nocookie.com/embed/wGigUFDfpxQ?rel=0')).toBe('wGigUFDfpxQ')
  })

  it('returns null for garbage input', () => {
    expect(extractYoutubeId('not a url or id')).toBeNull()
    expect(extractYoutubeId('https://example.com/video')).toBeNull()
    expect(extractYoutubeId('')).toBeNull()
  })
})
