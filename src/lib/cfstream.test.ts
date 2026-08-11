import { describe, expect, it } from 'vitest'
import { extractCfStreamId } from './cfstream'

const UID = '5d5bc37ffcf54c9b82e996823bffbb81'

describe('extractCfStreamId', () => {
  it('accepts a bare 32-hex uid', () => {
    expect(extractCfStreamId(UID)).toBe(UID)
    expect(extractCfStreamId(`  ${UID.toUpperCase()}  `)).toBe(UID)
  })

  it('extracts the uid from watch/embed urls', () => {
    expect(extractCfStreamId(`https://customer-abc123.cloudflarestream.com/${UID}/watch`)).toBe(UID)
    expect(extractCfStreamId(`https://customer-abc123.cloudflarestream.com/${UID}/iframe?poster=x`)).toBe(UID)
  })

  it('extracts the uid from a dash.cloudflare.com url (account id is also 32-hex — must take the last match)', () => {
    const accountId = 'aaaabbbbccccddddeeeeffff00001111'
    expect(extractCfStreamId(`https://dash.cloudflare.com/${accountId}/stream/videos/${UID}`)).toBe(UID)
  })

  it('rejects things that are not a uid', () => {
    expect(extractCfStreamId('')).toBeNull()
    expect(extractCfStreamId('https://youtu.be/OV0zmTR_d-8')).toBeNull()
    expect(extractCfStreamId('abcdef')).toBeNull()
    expect(extractCfStreamId('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBeNull()
  })
})
