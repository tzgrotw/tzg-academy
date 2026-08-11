import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const schema = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')

describe('database access-control migration', () => {
  it('blocks inactive or deleted courses and chapters', () => {
    expect(schema).toContain('WHEN NOT c.is_active OR c.deleted_at IS NOT NULL THEN false')
    expect(schema).toContain('ch.is_active AND ch.deleted_at IS NULL AND public.fn_can_access_course')
  })

  it('replaces stale read policies when schema is rerun', () => {
    for (const policy of ['courses_read', 'chapters_read', 'videos_read', 'assessments_read', 'rewards_read', 'academy_videos_read']) {
      expect(schema).toContain(`DROP POLICY IF EXISTS ${policy}`)
    }
  })

  it('limits progress writes to accessible active videos', () => {
    expect(schema).toContain('DROP POLICY IF EXISTS progress_own')
    expect(schema).toMatch(/v\.is_active\s+AND v\.deleted_at IS NULL\s+AND public\.fn_can_access_chapter/)
  })

  it('does not serve deleted assessments or storage videos', () => {
    expect(schema.match(/a\.is_active AND a\.deleted_at IS NULL/g)?.length).toBeGreaterThanOrEqual(2)
    expect(schema).toMatch(/v\.storage_path = storage\.objects\.name\s+AND v\.is_active\s+AND v\.deleted_at IS NULL/)
  })
})
