import { useCallback, useState } from 'react'

const WRAP_CLASS =
  'overflow-x-hidden whitespace-pre-wrap break-all rounded-lg border bg-surface-2 p-3 font-mono text-[12px] leading-relaxed text-ink'

export function JsonView({
  data,
  className = '',
  maxScalarLength = 64,
}: {
  data: unknown
  className?: string
  maxScalarLength?: number
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  return (
    <div className={`${WRAP_CLASS} ${className}`}>
      <JsonValue
        value={data}
        path="$"
        depth={0}
        maxLen={maxScalarLength}
        expanded={expanded}
        onToggle={toggle}
      />
    </div>
  )
}

function JsonValue({
  value,
  path,
  depth,
  maxLen,
  expanded,
  onToggle,
}: {
  value: unknown
  path: string
  depth: number
  maxLen: number
  expanded: Set<string>
  onToggle: (path: string) => void
}) {
  const pad = '  '.repeat(depth)

  if (value === null) {
    return <span className="text-[var(--color-near)]">null</span>
  }

  if (typeof value === 'boolean') {
    return <span className="text-[var(--color-near)]">{String(value)}</span>
  }

  if (typeof value === 'number') {
    return <span className="text-[var(--color-far)]">{String(value)}</span>
  }

  if (typeof value === 'string') {
    return (
      <StringValue
        value={value}
        path={path}
        maxLen={maxLen}
        isExpanded={expanded.has(path)}
        onToggle={onToggle}
      />
    )
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <>[]</>
    return (
      <>
        {'[\n'}
        {value.map((item, i) => (
          <span key={i}>
            {pad}
            {'  '}
            <JsonValue
              value={item}
              path={`${path}[${i}]`}
              depth={depth + 1}
              maxLen={maxLen}
              expanded={expanded}
              onToggle={onToggle}
            />
            {i < value.length - 1 ? ',' : ''}
            {'\n'}
          </span>
        ))}
        {pad}
        {']'}
      </>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <>{}</>
    return (
      <>
        {'{\n'}
        {entries.map(([key, v], i) => (
          <span key={key}>
            {pad}
            {'  '}
            <span className="text-[var(--color-indigo-deep)]">&quot;{key}&quot;</span>
            {': '}
            <JsonValue
              value={v}
              path={`${path}.${key}`}
              depth={depth + 1}
              maxLen={maxLen}
              expanded={expanded}
              onToggle={onToggle}
            />
            {i < entries.length - 1 ? ',' : ''}
            {'\n'}
          </span>
        ))}
        {pad}
        {'}'}
      </>
    )
  }

  return <span>{String(value)}</span>
}

function StringValue({
  value,
  path,
  maxLen,
  isExpanded,
  onToggle,
}: {
  value: string
  path: string
  maxLen: number
  isExpanded: boolean
  onToggle: (path: string) => void
}) {
  const isLong = value.length > maxLen
  const shown = isLong && !isExpanded ? `${value.slice(0, maxLen)}…` : value
  const formatted = JSON.stringify(shown)

  if (!isLong) {
    return <span className="text-[var(--color-ok)]">{formatted}</span>
  }

  return (
    <button
      type="button"
      title={isExpanded ? '点击收起' : '点击展开完整内容'}
      onClick={() => onToggle(path)}
      className="inline cursor-pointer border-0 bg-transparent p-0 font-inherit text-[var(--color-ok)] hover:underline"
    >
      {formatted}
    </button>
  )
}
