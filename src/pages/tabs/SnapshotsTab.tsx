import { useEffect, useRef, useState } from 'react'
import type { SnapshotDescription } from '../../lib/qdrant'
import {
  useSnapshots,
  useDeleteSnapshot,
  useUploadSnapshot,
} from '../../hooks/useQdrant'
import { qdrant } from '../../lib/qdrant'
import {
  loadSnapshotNotes,
  removeSnapshotNote,
  setSnapshotNote,
} from '../../lib/snapshotNotes'
import { Card, Loading, ErrorState, EmptyState } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field, Input } from '../../components/ui/fields'
import { useToast } from '../../components/ui/Toast'
import { usePermissions } from '../../hooks/useAuth'
import { formatBytes, formatTime } from '../../lib/format'
import {
  IconCamera,
  IconChevronRight,
  IconDownload,
  IconTrash,
  IconUpload,
  IconSpinner,
} from '../../components/ui/icons'
import { CreateBackupDialog } from '../dialogs/CreateBackupDialog'

export function SnapshotsTab({ name }: { name: string }) {
  const toast = useToast()
  const { canAdmin } = usePermissions()
  const { data, isLoading, error, refetch } = useSnapshots(name)
  const del = useDeleteSnapshot(name)
  const upload = useUploadSnapshot()
  const inputRef = useRef<HTMLInputElement>(null)

  const [notes, setNotes] = useState(() => loadSnapshotNotes(name))
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setNotes(loadSnapshotNotes(name))
    setExpanded(new Set())
  }, [name])

  function refreshNotes() {
    setNotes(loadSnapshotNotes(name))
  }

  function toggleExpanded(snapshotName: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(snapshotName)) next.delete(snapshotName)
      else next.add(snapshotName)
      return next
    })
  }

  async function download(snapshot: string) {
    setDownloading(snapshot)
    try {
      const res = await fetch(qdrant.snapshotDownloadUrl(name, snapshot), {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`下载失败（${res.status}）`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = snapshot
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '下载失败')
    } finally {
      setDownloading(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await del.mutateAsync(deleteTarget)
      removeSnapshotNote(name, deleteTarget)
      refreshNotes()
      toast.success('备份已删除')
      setDeleteTarget(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  async function restore(file: File) {
    try {
      await upload.mutateAsync({ name, file })
      toast.success('已从备份文件恢复到当前集合')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '恢复失败')
    }
  }

  function saveNote(snapshotName: string, note: string) {
    setSnapshotNote(name, snapshotName, note)
    refreshNotes()
  }

  return (
    <div className="space-y-4">
      <Card padded>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-[15px] font-semibold text-ink">备份&恢复</h3>
            <p className="mt-0.5 text-[12.5px] text-muted">
              为集合创建备份，可下载保存，或从备份文件恢复数据。
            </p>
          </div>
          {canAdmin && (
            <div className="flex items-center gap-2">
              <Button
                icon={<IconUpload />}
                onClick={() => inputRef.current?.click()}
                loading={upload.isPending}
              >
                上传恢复
              </Button>
              <Button variant="primary" icon={<IconCamera />} onClick={() => setCreateOpen(true)}>
                创建备份
              </Button>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".snapshot"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) restore(f)
            e.target.value = ''
          }}
        />
      </Card>

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Loading label="正在读取备份列表…" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="还没有备份"
          desc="创建备份以保存当前集合，或上传 .snapshot 备份文件进行恢复。"
          action={
            canAdmin ? (
              <Button variant="primary" icon={<IconCamera />} onClick={() => setCreateOpen(true)}>
                创建备份
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border bg-surface">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b bg-surface-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">名称</th>
                <th className="px-3 py-2.5">创建时间</th>
                <th className="px-3 py-2.5 text-right">大小</th>
                <th className="px-3 py-2.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <SnapshotRow
                  key={s.name}
                  snapshot={s}
                  note={notes[s.name] ?? ''}
                  expanded={expanded.has(s.name)}
                  onToggleExpand={() => toggleExpanded(s.name)}
                  onSaveNote={(note) => saveNote(s.name, note)}
                  downloading={downloading === s.name}
                  onDownload={() => download(s.name)}
                  onDelete={() => setDeleteTarget(s.name)}
                  canAdmin={canAdmin}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateBackupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        collectionName={name}
        onCreated={() => {
          refreshNotes()
          void refetch()
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="删除备份"
        danger
        confirmLabel="删除"
        loading={del.isPending}
        onConfirm={confirmDelete}
        message={
          <>
            确定删除备份 <span className="font-mono text-ink">{deleteTarget}</span> 吗？此操作不可撤销。
          </>
        }
      />
    </div>
  )
}

function SnapshotRow({
  snapshot,
  note,
  expanded,
  onToggleExpand,
  onSaveNote,
  downloading,
  onDownload,
  onDelete,
  canAdmin,
}: {
  snapshot: SnapshotDescription
  note: string
  expanded: boolean
  onToggleExpand: () => void
  onSaveNote: (note: string) => void
  downloading: boolean
  onDownload: () => void
  onDelete: () => void
  canAdmin: boolean
}) {
  const [draft, setDraft] = useState(note)

  useEffect(() => {
    setDraft(note)
  }, [note, snapshot.name])

  function commitNote() {
    if (draft.trim() !== note.trim()) onSaveNote(draft)
  }

  const hasDetails = Boolean(snapshot.checksum)

  return (
    <tr className="border-b transition last:border-0 hover:bg-surface-2">
      <td className="px-4 py-3 align-top">
        <div className="font-mono text-[12.5px] text-ink" title={snapshot.name}>
          {snapshot.name}
        </div>
        {note && !expanded && (
          <div className="mt-1 text-[12px] leading-snug text-muted">{note}</div>
        )}
        <button
          type="button"
          onClick={onToggleExpand}
          className="mt-1.5 flex cursor-pointer items-center gap-0.5 text-[12px] text-muted transition hover:text-ink"
          aria-expanded={expanded}
        >
          <IconChevronRight
            className={`text-sm transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          详情
        </button>
        {expanded && (
          <div className="mt-2 space-y-2 border-t pt-2">
            {hasDetails && (
              <div className="text-[12px]">
                <div className="text-muted">文件校验码</div>
                <div className="mt-0.5 break-all font-mono text-[11.5px] text-muted">
                  {snapshot.checksum}
                </div>
              </div>
            )}
            <Field label="备注" hint="仅保存在本浏览器">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitNote}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitNote()
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                placeholder="选填，例如：上线前备份"
                maxLength={200}
              />
            </Field>
          </div>
        )}
      </td>
      <td className="px-3 py-3 align-top text-muted">{formatTime(snapshot.creation_time)}</td>
      <td className="px-3 py-3 align-top text-right font-mono tnum text-ink">
        {formatBytes(snapshot.size)}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-center justify-end gap-1">
          <ActionBtn
            title="下载"
            icon={<IconDownload />}
            loading={downloading}
            onClick={onDownload}
          />
          {canAdmin && (
            <ActionBtn title="删除" danger icon={<IconTrash />} onClick={onDelete} />
          )}
        </div>
      </td>
    </tr>
  )
}

function ActionBtn({
  title,
  icon,
  onClick,
  danger,
  loading,
}: {
  title: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
  loading?: boolean
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={loading}
      className={`grid size-8 place-items-center rounded-lg text-[16px] transition disabled:opacity-50 ${
        danger
          ? 'text-muted hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]'
          : 'text-muted hover:bg-[var(--color-line)] hover:text-ink'
      }`}
    >
      {loading ? <IconSpinner /> : icon}
    </button>
  )
}
