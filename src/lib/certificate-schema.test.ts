import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const schema = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')

describe('formal certificate schema', () => {
  it('stores immutable certificate identity and verification fields', () => {
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS public.course_certificates')
    expect(schema).toContain('certificate_no TEXT NOT NULL UNIQUE')
    expect(schema).toContain('verification_code UUID NOT NULL UNIQUE')
    expect(schema).toContain('UNIQUE (user_id, course_id)')
  })

  it('checks all active videos and assessments on the server', () => {
    expect(schema).toContain('CREATE OR REPLACE FUNCTION public.fn_course_completed')
    expect(schema).toContain('vp.pct >= 95')
    expect(schema).toContain("s.status = 'passed'")
  })

  it('keeps issuance authenticated and verification public', () => {
    expect(schema).toContain('GRANT EXECUTE ON FUNCTION public.fn_issue_certificate(BIGINT) TO authenticated')
    expect(schema).toContain('GRANT EXECUTE ON FUNCTION public.fn_verify_certificate(TEXT) TO anon, authenticated')
    expect(schema).toContain('cc.revoked_at IS NULL')
  })
})
