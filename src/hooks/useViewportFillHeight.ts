import { useEffect, useState, type RefObject } from 'react'

/** 从 anchor 元素顶部到视口底部的可用高度（官方 Graph 页同款思路） */
export function useViewportFillHeight(
  anchorRef: RefObject<HTMLElement | null>,
  minHeight = 320,
  bottomGap = 0,
) {
  const [height, setHeight] = useState(minHeight)

  useEffect(() => {
    const el = anchorRef.current
    if (!el) return

    const update = () => {
      const top = el.getBoundingClientRect().top
      setHeight(Math.max(minHeight, window.innerHeight - top - bottomGap))
    }

    update()
    window.addEventListener('resize', update)
    const ro = new ResizeObserver(update)
    ro.observe(el)

    return () => {
      window.removeEventListener('resize', update)
      ro.disconnect()
    }
  }, [anchorRef, minHeight, bottomGap])

  return height
}
