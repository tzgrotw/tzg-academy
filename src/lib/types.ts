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
  deleted_at: string | null
}

export interface Chapter {
  key: string
  course_id: number
  title: string
  tagline: string
  cover_url: string | null
  sort_no: number
  is_active: boolean
  deleted_at: string | null
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
  cf_stream_id: string | null
  duration_sec: number | null
  sort_no: number
  is_active: boolean
  deleted_at: string | null
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

export type AssessmentKind = 'quiz' | 'assignment'
export type SubmissionStatus = 'pending' | 'passed' | 'failed'

export interface Assessment {
  id: number
  chapter_key: string
  kind: AssessmentKind
  title: string
  instructions: string
  pass_pct: number
  sort_no: number
  is_active: boolean
  deleted_at: string | null
}

// 學員端題目——特意不含 correct_index，只能透過 fn_quiz_questions() RPC 拿到
export interface QuizQuestionPublic {
  id: number
  question: string
  options: string[]
  sort_no: number
}

// 後台編輯用（quiz_questions 表只有 admin 讀得到，含正確答案）
export interface QuizQuestion extends QuizQuestionPublic {
  assessment_id: number
  correct_index: number
}

export interface AssessmentSubmission {
  user_id: string
  assessment_id: number
  answers: Record<string, number> | null
  score_pct: number | null
  file_path: string | null
  note: string | null
  status: SubmissionStatus
  feedback: string | null
  submitted_at: string
  reviewed_at: string | null
}

export interface Certificate {
  certificate_no: string
  verification_code: string
  course_id: number
  learner_name: string
  course_title: string
  certificate_title: string
  issued_at: string
  revoked_at: string | null
}

export interface VerifiedCertificate extends Omit<Certificate, 'verification_code' | 'course_id'> {
  valid: boolean
}
