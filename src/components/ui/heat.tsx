import { heatColor } from '../../lib/format'

/**
 * 相似度热力条：招牌视觉语言。
 * value ∈ [0,1]，越接近 1（越相似）越暖金，越接近 0 越冷蓝。
 */
export function HeatBar({
  value,
  width = 120,
  grow = false,
  showValue = true,
}: {
  value: number
  width?: number
  grow?: boolean
  showValue?: boolean
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  const color = heatColor(value)
  return (
    <span className={`inline-flex items-center gap-2 ${grow ? 'flex-1' : ''}`}>
      <span
        className={`relative h-2 overflow-hidden rounded-full bg-[var(--color-line)] ${grow ? 'block flex-1' : 'inline-block'}`}
        style={grow ? undefined : { width }}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </span>
      {showValue && (
        <span className="font-mono text-[12px] tnum" style={{ color }}>
          {value.toFixed(3)}
        </span>
      )}
    </span>
  )
}

/** 图例：解释暖/冷两端的含义 */
export function HeatLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-[11.5px] text-muted ${className}`}>
      <span>远</span>
      <span
        className="h-1.5 w-24 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})`,
        }}
      />
      <span>近 · 相似</span>
    </div>
  )
}
