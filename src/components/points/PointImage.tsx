import { useState } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { IconClose } from '../ui/icons'

/** 与官方 PointImage.jsx 一致的 URL 检测逻辑 */
export function isImgUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url.pathname)
  } catch {
    return false
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** 指定字段作为缩略图来源（允许无扩展名的 http(s) URL） */
const DESIGNATED_THUMBS: { key: string; label: string }[] = [
  { key: 'image_url', label: '原图' },
  { key: 'mask_url', label: '掩码' },
]

export interface PayloadThumbnail {
  key: string
  url: string
  label?: string
}

function isDesignatedThumbUrl(value: string): boolean {
  return isImgUrl(value) || isHttpUrl(value)
}

/** 从 payload 收集缩略图：优先 image_url / mask_url，其余字符串字段仍按扩展名自动识别 */
export function findPayloadThumbnails(payload: Record<string, unknown>): PayloadThumbnail[] {
  const result: PayloadThumbnail[] = []
  const seenUrls = new Set<string>()

  for (const { key, label } of DESIGNATED_THUMBS) {
    const value = payload[key]
    if (typeof value === 'string' && isDesignatedThumbUrl(value)) {
      result.push({ key, url: value, label })
      seenUrls.add(value)
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    if (DESIGNATED_THUMBS.some((d) => d.key === key)) continue
    if (typeof value === 'string' && isImgUrl(value) && !seenUrls.has(value)) {
      result.push({ key, url: value })
      seenUrls.add(value)
    }
  }

  return result
}

/** @deprecated 使用 findPayloadThumbnails */
export function findPayloadImageUrls(payload: Record<string, unknown>): string[] {
  return findPayloadThumbnails(payload).map((t) => t.url)
}

/** 缩略图下方标签占位（gap + 文字行） */
const THUMB_LABEL_EXTRA = 18

export function getThumbLayout(thumbs: PayloadThumbnail[]) {
  const thumbSize = thumbs.length > 1 ? 96 : 112
  const hasLabel = thumbs.some((t) => t.label)
  return {
    thumbSize,
    blockHeight: thumbSize + (hasLabel ? THUMB_LABEL_EXTRA : 0),
  }
}

function Thumb({
  url,
  label,
  size,
  onOpen,
}: {
  url: string
  label?: string
  size: number
  onOpen: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const px = `${size}px`

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onOpen}
        className="relative shrink-0 cursor-pointer overflow-hidden rounded-[5px] border border-[var(--color-line-strong)] bg-surface-2 transition hover:border-[var(--color-indigo)]"
        style={{ width: px, height: px }}
        title={label ? `点击查看${label}` : '点击查看大图'}
      >
        {!loaded && !failed && (
          <span className="block size-full animate-pulse bg-[var(--color-line)]/40" aria-hidden />
        )}
        {failed ? (
          <span className="flex size-full items-center justify-center px-2 text-center text-[11px] text-muted">
            加载失败
          </span>
        ) : (
          <img
            src={url}
            alt={label ?? ''}
            decoding="async"
            className={`size-full object-contain transition-opacity ${loaded ? 'opacity-100' : 'absolute inset-0 opacity-0'}`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
      </button>
      {label && <span className="text-[10px] text-muted">{label}</span>}
    </div>
  )
}

/** 官方 CardMedia：卡片渲染后立即加载缩略图，不用 lazy */
export function PointImage({
  payload,
  variant = 'thumb',
}: {
  payload: Record<string, unknown>
  variant?: 'thumb' | 'preview'
}) {
  const thumbs = findPayloadThumbnails(payload)
  const [fullScreen, setFullScreen] = useState<string | null>(null)

  if (thumbs.length === 0) return null

  const { thumbSize } = getThumbLayout(thumbs)
  const previewSize = 300

  return (
    <>
      <div
        className={
          variant === 'preview'
            ? 'flex flex-col items-center gap-3 py-6'
            : 'flex h-full flex-row items-start justify-end gap-2'
        }
      >
        {thumbs.map((thumb) => (
          <Thumb
            key={`${thumb.key}:${thumb.url}`}
            url={thumb.url}
            label={variant === 'preview' ? undefined : thumb.label}
            size={variant === 'preview' ? previewSize : thumbSize}
            onOpen={() => setFullScreen(thumb.url)}
          />
        ))}
      </div>

      <RadixDialog.Root open={!!fullScreen} onOpenChange={(open) => !open && setFullScreen(null)}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay
            className="fixed inset-0 z-[120] cursor-pointer bg-black/75 backdrop-blur-[1px]"
            onClick={() => setFullScreen(null)}
          />
          <RadixDialog.Content className="fixed left-1/2 top-1/2 z-[121] max-h-[92vh] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 outline-none">
            <button
              type="button"
              onClick={() => setFullScreen(null)}
              className="absolute -top-12 right-0 cursor-pointer rounded-md bg-black/50 px-2.5 py-1.5 text-[13px] text-white transition hover:bg-black/70"
            >
              关闭 [ESC]
            </button>
            {fullScreen && (
              <img
                src={fullScreen}
                alt=""
                className="max-h-[92vh] max-w-[92vw] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <RadixDialog.Close
              className="absolute -right-2 -top-12 grid size-8 place-items-center rounded-md bg-black/50 text-white opacity-0"
              aria-label="关闭"
            >
              <IconClose />
            </RadixDialog.Close>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </>
  )
}
