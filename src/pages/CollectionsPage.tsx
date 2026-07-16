import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useCollectionRows,
  useDeleteCollection,
  type CollectionRow,
} from '../hooks/useQdrant'
import { primaryVectorParams } from '../lib/qdrant'
import { distanceLabel, formatInt } from '../lib/format'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/fields'
import {
  StatusDot,
  Loading,
  EmptyState,
  ErrorState,
} from '../components/ui/primitives'
import { IconPlus, IconUpload, IconSearch, IconTrash, IconRefresh, IconSpinner } from '../components/ui/icons'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import { CreateCollectionDialog } from './dialogs/CreateCollectionDialog'
import { UploadSnapshotDialog } from './dialogs/UploadSnapshotDialog'

export function CollectionsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { rows, names, isLoading, isFetching, error, refetch, refetchAll } = useCollectionRows()
  const del = useDeleteCollection()

  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q))
  }, [rows, query])

  async function confirmDelete() {
    if (!deleteTarget) return
    const name = deleteTarget
    setDeleteTarget(null)
    try {
      await del.mutateAsync(name)
      toast.success(`集合「${name}」已删除`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  async function refreshAll() {
    try {
      await refetchAll()
      toast.success('集合列表已刷新')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '刷新失败')
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-8 py-8">
      <header className="mb-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="font-title text-[24px] font-medium leading-none tracking-wide text-ink">
              集合
            </h1>
            <button
              type="button"
              aria-label="刷新全部集合"
              title="刷新全部集合"
              disabled={isFetching}
              onClick={refreshAll}
              className="grid size-8 place-items-center rounded-lg text-[17px] text-muted transition hover:bg-[var(--color-line)] hover:text-ink disabled:cursor-wait disabled:text-[var(--color-indigo)]"
            >
              {isFetching ? <IconSpinner /> : <IconRefresh />}
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Button size="lg" icon={<IconUpload />} onClick={() => setShowUpload(true)}>
              上传备份
            </Button>
            <Button size="lg" variant="primary" icon={<IconPlus />} onClick={() => setShowCreate(true)}>
              创建集合
            </Button>
          </div>
        </div>
        <div className="relative w-full">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-muted-soft" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索集合"
            className="h-9.5 w-full pl-8"
          />
        </div>
      </header>

      {error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Loading label="正在读取集合列表…" />
      ) : names.length === 0 ? (
        <EmptyState
          title="还没有集合"
          desc="创建第一个向量集合，或从备份文件恢复已有数据。"
          action={
            <div className="flex gap-2">
              <Button variant="secondary" icon={<IconUpload />} onClick={() => setShowUpload(true)}>
                上传备份
              </Button>
              <Button variant="primary" icon={<IconPlus />} onClick={() => setShowCreate(true)}>
                创建集合
              </Button>
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="没有匹配的集合" desc={`未找到包含「${query}」的集合。`} />
      ) : (
        <CollectionsTable
          rows={filtered}
          onOpen={(name) => navigate(`/collections/${encodeURIComponent(name)}/points`)}
          onDelete={setDeleteTarget}
        />
      )}

      <CreateCollectionDialog open={showCreate} onOpenChange={setShowCreate} existingNames={names} />
      <UploadSnapshotDialog open={showUpload} onOpenChange={setShowUpload} />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="删除集合"
        danger
        confirmLabel="删除"
        loading={del.isPending}
        onConfirm={confirmDelete}
        message={
          <>
            确定删除集合{' '}
            <span className="font-mono font-semibold text-ink">{deleteTarget}</span>
            ？该操作不可撤销。
          </>
        }
      />
    </div>
  )
}

function CollectionsTable({
  rows,
  onOpen,
  onDelete,
}: {
  rows: CollectionRow[]
  onOpen: (name: string) => void
  onDelete: (name: string) => void
}) {
  const rowGrid = 'grid grid-cols-6 items-center gap-x-6 px-5'
  const th = 'min-w-0 py-3 text-center text-[12px] font-medium leading-none text-muted'
  const td = 'min-w-0 py-3.5 text-center text-[13px] leading-snug text-ink'
  const empty = 'text-muted'

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border bg-surface">
      <div className={`${rowGrid} border-b bg-surface-2`} role="row">
        <div className={th} role="columnheader">
          名称
        </div>
        <div className={th} role="columnheader">
          状态
        </div>
        <div className={th} role="columnheader">
          点数
        </div>
        <div className={th} role="columnheader">
          信息
        </div>
        <div className={th} role="columnheader">
          分段
        </div>
        <div className={th} role="columnheader">
          操作
        </div>
      </div>

      <div role="rowgroup">
        {rows.map((r) => {
          const vp = primaryVectorParams(r.info?.config)
          return (
            <div
              key={r.name}
              role="row"
              onClick={() => onOpen(r.name)}
              className={`${rowGrid} group cursor-pointer border-b transition last:border-0 hover:bg-[var(--color-indigo-soft)]/40`}
            >
              <div className={`${td} min-w-0`} role="cell">
                  <span className="inline-block max-w-full truncate font-mono font-medium transition group-hover:underline group-hover:decoration-[var(--color-indigo)] group-hover:underline-offset-2">
                    {r.name}
                  </span>
                  {vp.named.length > 0 && (
                    <div className="mx-auto mt-1 max-w-full truncate text-[11px] leading-none">
                      命名向量：{vp.named.join('、')}
                    </div>
                  )}
                </div>

                <div className={`${td} flex justify-center`} role="cell">
                  {r.error ? (
                    <span className="text-[12px] text-[var(--color-danger)]">读取失败</span>
                  ) : r.info ? (
                    <StatusDot status={r.info.status} showLabel />
                  ) : (
                    <span className={empty}>…</span>
                  )}
                </div>

                <div className={`${td} font-mono tnum`} role="cell">
                  {r.info ? formatInt(r.info.points_count) : <span className={empty}>—</span>}
                </div>

                <div className={`${td} min-w-0`} role="cell">
                  {vp.size != null ? (
                    <span className="inline-block max-w-full truncate">
                      {vp.size} 维 · {distanceLabel(vp.distance)}
                    </span>
                  ) : (
                    <span className={empty}>—</span>
                  )}
                </div>

                <div className={`${td} font-mono tnum`} role="cell">
                  {r.info ? r.info.segments_count : <span className={empty}>—</span>}
                </div>

                <div className={`${td} flex justify-center`} role="cell">
                  <button
                    type="button"
                    title="删除"
                    aria-label="删除"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(r.name)
                    }}
                    className="grid size-8 place-items-center rounded-lg text-[16px] text-muted transition hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                  >
                    <IconTrash />
                  </button>
                </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
