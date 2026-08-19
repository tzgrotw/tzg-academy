// 細線條 icon（取代系統 emoji）——單色、承接父層 color，跟金色/暗紅品牌色一致。
type IconProps = { size?: number; className?: string }

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function IconPhone({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="7" y="2" width="10" height="20" rx="2.4" />
      <line x1="10.5" y1="18.4" x2="13.5" y2="18.4" />
    </svg>
  )
}

export function IconBookmark({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M6.5 3h11a1 1 0 0 1 1 1v17l-6.5-4.6L5.5 21V4a1 1 0 0 1 1-1z" />
    </svg>
  )
}

export function IconCrown({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4.5 18.5h15l-1.4-8.3-4.3 3.6L12 6l-1.8 7.8-4.3-3.6-1.4 8.3z" strokeLinejoin="round" />
      <line x1="5.3" y1="21" x2="18.7" y2="21" />
    </svg>
  )
}

export function IconLock({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </svg>
  )
}

export function IconCheck({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <polyline points="5 13 10 18 19 7" />
    </svg>
  )
}

export function IconAward({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="8.5" r="5.5" />
      <path d="M8.7 13.3 6.8 22l5.2-3.1 5.2 3.1-1.9-8.7" />
    </svg>
  )
}

export function IconLightbulb({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 2.5a6.5 6.5 0 0 0-3.7 11.8c.55.45.95 1.1.95 1.85V17h5.5v-.85c0-.75.4-1.4.95-1.85A6.5 6.5 0 0 0 12 2.5z" />
      <line x1="9.7" y1="20.2" x2="14.3" y2="20.2" />
      <line x1="10.3" y1="17" x2="13.7" y2="17" />
    </svg>
  )
}

export function IconFilm({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <line x1="7.5" y1="4.5" x2="7.5" y2="19.5" />
      <line x1="16.5" y1="4.5" x2="16.5" y2="19.5" />
      <line x1="3" y1="9.5" x2="7.5" y2="9.5" />
      <line x1="3" y1="14.5" x2="7.5" y2="14.5" />
      <line x1="16.5" y1="9.5" x2="21" y2="9.5" />
      <line x1="16.5" y1="14.5" x2="21" y2="14.5" />
    </svg>
  )
}

export function IconGrip({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
      <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
    </svg>
  )
}

export function IconTrash({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 7h16" />
      <path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7" />
      <path d="M6 7l1 13a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9l1-13" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

export function IconChevron({ size = 16, className, open }: IconProps & { open?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}
      style={{ transform: open ? 'rotate(90deg)' : undefined, transition: '.2s' }} {...base}>
      <polyline points="9 5 16 12 9 19" />
    </svg>
  )
}

export function IconClipboard({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="5.5" y="4.5" width="13" height="17" rx="2" />
      <rect x="9" y="2.5" width="6" height="3.5" rx="1" />
      <polyline points="8.5 12.5 11 15 15.5 9.5" />
    </svg>
  )
}

export function IconFileText({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M7 3h6.5L19 8.5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <polyline points="13.5 3 13.5 8.5 19 8.5" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="16.5" x2="15" y2="16.5" />
    </svg>
  )
}

export function IconX({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  )
}

export function IconUsers({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3.5 20c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2" />
      <path d="M15.2 5.2a3.4 3.4 0 0 1 0 5.7" />
      <path d="M17.5 15.1c1.7.7 2.7 2.3 3 4.9" />
    </svg>
  )
}

export function IconCalendar({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <line x1="4" y1="10" x2="20" y2="10" />
      <line x1="8.5" y1="3.5" x2="8.5" y2="7" />
      <line x1="15.5" y1="3.5" x2="15.5" y2="7" />
    </svg>
  )
}

export function IconReceipt({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M6 3h12v18l-2.4-1.6L13.2 21l-2.4-1.6L8.4 21 6 19.4V3z" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  )
}

export function IconChart({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <line x1="4" y1="20" x2="20" y2="20" />
      <line x1="7.5" y1="20" x2="7.5" y2="12" />
      <line x1="12" y1="20" x2="12" y2="6" />
      <line x1="16.5" y1="20" x2="16.5" y2="9.5" />
    </svg>
  )
}

export function IconLinkChain({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.24 4.24 0 0 0-6-6l-1.5 1.5" />
      <path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.24 4.24 0 0 0 6 6l1.5-1.5" />
    </svg>
  )
}
