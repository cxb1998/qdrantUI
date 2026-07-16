import type { PointStruct } from '../../lib/qdrant'
import { PointImage, findPayloadThumbnails } from '../points/PointImage'
import { PointPayload } from '../points/PointPayload'

/** 与官方 PointPreview.jsx 结构一致：标题 → 居中预览图 → Payload（仅 JSON） */
export function PointPreview({
  point,
  collectionName,
}: {
  point: PointStruct
  collectionName: string
}) {
  const payload = point.payload
  const hasPayload = payload && Object.keys(payload).length > 0
  const hasPreviewImage = hasPayload && findPayloadThumbnails(payload).length > 0

  return (
    <div className="flex min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-paper)_80%,transparent)] px-4">
        <h3 className="font-mono text-[15px] font-semibold text-ink">Point {String(point.id)}</h3>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {hasPayload ? (
          <>
            {hasPreviewImage && (
              <>
                <PointImage payload={payload} variant="preview" />
                <div className="border-b border-[var(--color-line)]" />
              </>
            )}
            <div className="px-4 py-3">
              <PointPayload
                point={point}
                collectionName={collectionName}
                showImage={false}
                buttonsToShow={['copy']}
                label="Payload"
              />
            </div>
          </>
        ) : (
          <p className="px-4 py-3 text-[13px] text-muted">该点没有附加数据（payload）。</p>
        )}
      </div>
    </div>
  )
}
