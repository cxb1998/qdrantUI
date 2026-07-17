import { useEffect, useState } from 'react'
import type { CollectionInfo, PointStruct } from '../../lib/qdrant'
import { primaryVectorParams, qdrant } from '../../lib/qdrant'
import type { PayloadFilterCondition } from '../../lib/pointsFilter'
import { heatColor } from '../../lib/format'
import { PointPayload } from './PointPayload'
import { PointVectors } from './PointVectors'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'
import { usePermissions } from '../../hooks/useAuth'
import { IconTrash } from '../ui/icons'

export function PointCard({
  point: initialPoint,
  collectionName,
  info,
  score,
  onFindSimilar,
  onDeleted,
  graphFilters,
}: {
  point: PointStruct
  collectionName: string
  info: CollectionInfo
  score?: number
  onFindSimilar?: (id: string | number, vectorName?: string | null) => void
  onDeleted?: () => void
  graphFilters?: PayloadFilterCondition[]
}) {
  const toast = useToast()
  const { canWrite } = usePermissions()
  const [point, setPoint] = useState(initialPoint)
  const [removed, setRemoved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    setPoint(initialPoint)
    setRemoved(false)
  }, [initialPoint])

  if (removed) return null

  const hasPayload = point.payload && Object.keys(point.payload).length > 0
  const hasVectors = primaryVectorParams(info.config).size != null

  async function handleDelete() {
    setDeleteOpen(false)
    setLoading(true)
    try {
      await qdrant.deletePoints(collectionName, [point.id])
      toast.success(`已删除点 ${point.id}`)
      setRemoved(true)
      onDeleted?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <article
        className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border bg-surface"
        role="listitem"
      >
        {loading && (
          <div className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-[var(--color-indigo)]" />
        )}

        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="font-mono text-[15px] font-semibold text-ink">Point {String(point.id)}</h3>
            {score != null && (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[11.5px] tnum"
                style={{
                  color: heatColor(score),
                  background: `color-mix(in srgb, ${heatColor(score)} 18%, transparent)`,
                }}
              >
                {score.toFixed(4)}
              </span>
            )}
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              title="删除点"
              aria-label="删除点"
              className="grid size-8 cursor-pointer place-items-center rounded-md text-muted transition hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
            >
              <IconTrash className="text-[17px]" />
            </button>
          )}
        </header>

        {hasPayload && (
          <div className="px-4 py-3">
            <PointPayload
              point={point}
              collectionName={collectionName}
              showImage
              buttonsToShow={canWrite ? ['copy', 'edit'] : ['copy']}
              onPayloadEdit={(payload) => setPoint((p) => ({ ...p, payload }))}
            />
          </div>
        )}

        {hasVectors && (
          <>
            <div className="border-t" />
            <div className="px-4 py-3">
              <PointVectors
                point={point}
                info={info}
                onFindSimilar={onFindSimilar}
                graphFilters={graphFilters}
              />
            </div>
          </>
        )}
      </article>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`删除点 ${point.id}`}
        message={
          <>
            确定删除点 <span className="font-mono">{String(point.id)}</span> ？
            <br />
            该操作不可撤销。
          </>
        }
        confirmLabel="删除"
        danger
        loading={loading}
        onConfirm={handleDelete}
      />
    </>
  )
}
