export function formatInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('zh-CN')
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${value >= 100 || i === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`
}

export function formatPercent(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

export function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`
  if (ms < 1000) return `${ms.toFixed(1)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

const DISTANCE_LABEL: Record<string, string> = {
  Cosine: '余弦',
  Euclid: '欧氏',
  Dot: '点积',
  Manhattan: '曼哈顿',
}

export function distanceLabel(d: string | null | undefined): string {
  if (!d) return '—'
  return DISTANCE_LABEL[d] ?? d
}

/**
 * 相似度热力配色：近(相似) → 暖金，远 → 冷蓝。
 * t=1 表示最相似，t=0 表示最不相似。
 */
export function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  // 冷蓝 #3E63DD → 中性 #B58A6E → 暖金 #F0A63A
  const cold = [62, 99, 221]
  const mid = [181, 138, 110]
  const warm = [240, 166, 58]
  const lerp = (a: number[], b: number[], k: number) =>
    a.map((v, i) => Math.round(v + (b[i] - v) * k))
  const rgb =
    clamped < 0.5
      ? lerp(cold, mid, clamped / 0.5)
      : lerp(mid, warm, (clamped - 0.5) / 0.5)
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}
