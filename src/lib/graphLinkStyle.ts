/** 连边相似度：仅线宽编码，统一灰色；箭头随相似度轻微放大 */

export const LINK_COLOR = '#a6a6a6'

const WIDTH_MIN = 1
const WIDTH_MAX = 2.25
const ARROW_MIN = 2.8
const ARROW_MAX = 3.6

export type LinkScoreStyle = {
  width: number
  color: string
  arrowLength: number
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** 平滑插值，避免档位切换太生硬 */
function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

/** 在当前可见边内归一化 score */
export function createLinkScoreStyle(scores: number[]): (score: number) => LinkScoreStyle {
  const valid = scores.filter((s) => Number.isFinite(s))
  if (valid.length === 0) {
    return () => ({ width: WIDTH_MIN, color: LINK_COLOR, arrowLength: ARROW_MIN })
  }

  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const span = max - min

  return (score: number) => {
    const linear = span === 0 ? 1 : clamp01((score - min) / span)
    const t = smoothstep(linear)

    return {
      width: lerp(WIDTH_MIN, WIDTH_MAX, t),
      color: LINK_COLOR,
      // 箭头只略随线宽变化，避免粗线配过大三角
      arrowLength: lerp(ARROW_MIN, ARROW_MAX, t),
    }
  }
}

export const LINK_STYLE_LEGEND = [
  { label: '较低', width: WIDTH_MIN },
  { label: '中等', width: lerp(WIDTH_MIN, WIDTH_MAX, 0.5) },
  { label: '较高', width: WIDTH_MAX },
] as const
