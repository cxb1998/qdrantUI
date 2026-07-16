import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconSpinner } from './icons'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

const base =
  'inline-flex cursor-pointer select-none items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap'

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-indigo)] text-white hover:bg-[var(--color-indigo-deep)] active:translate-y-px',
  secondary:
    'border bg-surface text-ink hover:bg-surface-2 hover:border-[var(--color-line-strong)]',
  ghost: 'text-muted hover:bg-[var(--color-line)]/60 hover:text-ink',
  danger:
    'border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[13px]',
  md: 'h-9.5 px-3.5 text-sm',
  lg: 'h-10 min-w-[132px] px-5 text-[14px]',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <IconSpinner className="text-[15px]" /> : icon ? <span className="text-[15px]">{icon}</span> : null}
      {children}
    </button>
  )
}
