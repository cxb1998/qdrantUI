import { useState } from 'react'
import { JsonView } from '../ui/JsonView'
import { findPayloadThumbnails, getThumbLayout, PointImage } from './PointImage'
import { PayloadEditor } from './PayloadEditor'
import { IconCopy, IconPencil } from '../ui/icons'
import { useToast } from '../ui/Toast'
import type { PointStruct } from '../../lib/qdrant'

export function PointPayload({
  point,
  collectionName,
  showImage = true,
  buttonsToShow = ['copy', 'edit'],
  label = '标量',
  onPayloadEdit,
}: {
  point: PointStruct
  collectionName: string
  showImage?: boolean
  buttonsToShow?: ('copy' | 'edit')[]
  label?: string
  onPayloadEdit?: (payload: Record<string, unknown>) => void
}) {
  const toast = useToast()
  const [editorOpen, setEditorOpen] = useState(false)
  const payload = point.payload
  if (!payload || Object.keys(payload).length === 0) return null

  const thumbnails = showImage ? findPayloadThumbnails(payload) : []
  const hasImage = thumbnails.length > 0
  const thumbLayout = hasImage ? getThumbLayout(thumbnails) : null

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      toast.success('标量已复制到剪贴板')
    } catch {
      toast.error('复制失败')
    }
  }

  return (
    <>
      <div>
        <div className="mb-2 flex items-center gap-0.5">
          <span className="text-[13px] font-semibold text-ink">{label}</span>
          {buttonsToShow.includes('copy') && (
            <button
              type="button"
              onClick={copyPayload}
              title="复制标量"
              aria-label="复制标量"
              className="grid size-8 cursor-pointer place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              <IconCopy className="text-[16px]" />
            </button>
          )}
          {buttonsToShow.includes('edit') && (
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              title="编辑标量"
              aria-label="编辑标量"
              className="grid size-8 cursor-pointer place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              <IconPencil className="text-[16px]" />
            </button>
          )}
        </div>
        <div className="flex gap-3" style={thumbLayout ? { height: thumbLayout.blockHeight } : undefined}>
          <div className="min-h-0 min-w-0 flex-1">
            <JsonView data={payload} className={thumbLayout ? 'h-full overflow-y-auto' : ''} />
          </div>
          {showImage && hasImage && (
            <div className="h-full shrink-0">
              <PointImage payload={payload} />
            </div>
          )}
        </div>
      </div>

      {buttonsToShow.includes('edit') && (
        <PayloadEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          collectionName={collectionName}
          pointId={point.id}
          payload={payload}
          onSaved={(next) => onPayloadEdit?.(next)}
        />
      )}
    </>
  )
}
