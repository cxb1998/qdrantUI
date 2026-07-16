import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string
  hint?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-muted">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-lg border bg-surface px-3 py-2 text-[13px] text-ink transition placeholder:text-muted-soft focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/15'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputCls} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputCls} font-mono leading-relaxed ${className}`} {...props} />
}

export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputCls} cursor-pointer appearance-none pr-8 ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-[13px] text-ink"
    >
      <span
        className="relative h-5 w-9 rounded-full transition-colors"
        style={{ background: checked ? 'var(--color-indigo)' : 'var(--color-line-strong)' }}
      >
        <span
          className="absolute top-0.5 size-4 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? '18px' : '2px' }}
        />
      </span>
      {label}
    </button>
  )
}
