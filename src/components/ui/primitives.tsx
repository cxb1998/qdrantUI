import type { CollectionStatus } from '../../lib/qdrant'
import type { ReactNode } from 'react'
import { IconSpinner, IconAlert } from './icons'

// ---------- 卡片 ----------
export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border bg-surface ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function SectionTitle({
  title,
  desc,
  right,
}: {
  title: string
  desc?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>
        {desc && <p className="mt-0.5 text-[12.5px] text-muted">{desc}</p>}
      </div>
      {right}
    </div>
  )
}

// ---------- 指标 ----------
export function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: ReactNode
  hint?: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border bg-surface-2 px-4 py-3">
      <div className="text-[11.5px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div
        className="mt-1 font-display text-[22px] font-semibold leading-none tnum"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[11.5px] text-muted-soft">{hint}</div>}
    </div>
  )
}

// ---------- 状态点 ----------
const STATUS: Record<CollectionStatus, { color: string; label: string }> = {
  green: { color: 'var(--color-ok)', label: '正常' },
  yellow: { color: 'var(--color-warn)', label: '优化中' },
  red: { color: 'var(--color-danger)', label: '异常' },
  grey: { color: 'var(--color-muted-soft)', label: '待优化' },
}

export function StatusDot({
  status,
  showLabel,
  size = 'md',
}: {
  status: CollectionStatus
  showLabel?: boolean
  size?: 'md' | 'lg'
}) {
  const s = STATUS[status] ?? STATUS.grey
  const dot = size === 'lg' ? 'size-2.5' : 'size-2'
  const label = size === 'lg' ? 'text-[15px] font-medium' : 'text-[13px]'
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`${dot} rounded-full`}
        style={{ background: s.color, boxShadow: `0 0 0 3px color-mix(in srgb, ${s.color} 18%, transparent)` }}
      />
      {showLabel && <span className={`${label} text-ink`}>{s.label}</span>}
    </span>
  )
}

// ---------- 标签 ----------
export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'indigo' | 'mono' }) {
  const tones: Record<string, string> = {
    neutral: 'border bg-surface-2 text-muted',
    indigo: 'border-transparent bg-[var(--color-indigo-soft)] text-[var(--color-indigo-deep)]',
    mono: 'border bg-surface-2 text-ink font-mono',
  }
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11.5px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

// ---------- 加载/空/错误态 ----------
export function Loading({ label = '加载中…', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-16 text-muted ${className}`}>
      <IconSpinner className="text-lg" />
      <span className="text-[13px]">{label}</span>
    </div>
  )
}

export function EmptyState({
  title,
  desc,
  action,
}: {
  title: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <div className="dot-grid flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed py-16 text-center">
      <h4 className="font-display text-[15px] font-semibold text-ink">{title}</h4>
      {desc && <p className="mt-1 max-w-sm text-[13px] text-muted">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)]/50 py-14 text-center">
      <IconAlert className="text-2xl text-[var(--color-danger)]" />
      <p className="max-w-md text-[13px] text-ink">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border bg-surface px-3 py-1.5 text-[13px] text-ink transition hover:bg-surface-2"
        >
          重试
        </button>
      )}
    </div>
  )
}
