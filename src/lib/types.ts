// 資料庫型別——跟 supabase/schema.sql 一對一，改表要一起改這裡
export type Tier = 'member' | 'agent' | 'admin'
export type Audience = 'public' | 'member' | 'agent'

export interface Profile {
  user_id: string
  email: string
  name: string
  tier: Tier
  created_at: string
}

export interface Course {
  id: number
  title: string
  tagline: string
  audience: Audience
  cover_url: string | null
  sort_no: number
  is_active: boolean
}

export interface Chapter {
  key: string
  course_id: number
  title: string
  tagline: string
  cover_url: string | null
  sort_no: number
  is_active: boolean
}

export interface Section {
  id: number
  chapter_key: string
  heading: string
  items: string[]
  note: string | null
  sort_no: number
  is_active: boolean
}

export type MaterialKind = 'video' | 'doc' | 'image'

export interface Material {
  id: number
  chapter_key: string
  label: string
  kind: MaterialKind
  storage_path: string | null
  youtube_id: string | null
  duration_sec: number | null
  sort_no: number
  is_active: boolean
}

export interface Progress {
  user_id: string
  video_id: number
  pct: number
  last_sec: number
  completed_at: string | null
}

export interface Reward {
  id: number
  course_id: number
  after_chapter: string | null
  title: string
  message: string
}
