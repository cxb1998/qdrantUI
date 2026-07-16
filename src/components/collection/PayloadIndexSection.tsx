import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { CollectionInfo } from '../../lib/qdrant'
import { qdrant } from '../../lib/qdrant'
import {
  useCreatePayloadIndex,
  useDeletePayloadIndex,
} from '../../hooks/useQdrant'
import { Card, SectionTitle, EmptyState, Tag } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/fields'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'
import { formatInt } from '../../lib/format'
import { IconTrash } from '../../components/ui/icons'

const INDEX_TYPES = [
  { value: 'keyword', label: '关键词（字符串）', sortable: false },
  { value: 'integer', label: '整数', sortable: true },
  { value: 'float', label: '浮点数', sortable: true },
  { value: 'bool', label: '布尔', sortable: false },
  { value: 'datetime', label: '日期时间', sortable: true },
  { value: 'text', label: '全文', sortable: false },
] as const

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  INDEX_TYPES.map((t) => [t.value, t.label]),
)

export function PayloadIndexSection({ name, info }: { name: string; info: CollectionInfo }) {
  const toast = useToast()
  const createIndex = useCreatePayloadIndex(name)
  const deleteIndex = useDeletePayloadIndex(name)

  const [fieldName, setFieldName] = useState('')
  const [fieldType, setFieldType] = useState<string>('keyword')
  const [deleteField, setDeleteField] = useState<string | null>(null)

  const sampleKeysQuery = useQuery({
    queryKey: ['payload-keys', name],
    queryFn: ({ signal }) => qdrant.samplePayloadKeys(name, signal),
  })

  const indexed = useMemo(
    () => Object.entries(info.payload_schema ?? {}),
    [info.payload_schema],
  )
  const indexedSet = useMemo(() => new Set(indexed.map(([k]) => k)), [indexed])
  const suggestions = useMemo(
    () => (sampleKeysQuery.data ?? []).filter((k) => !indexedSet.has(k)),
    [sampleKeysQuery.data, indexedSet],
  )

  async function handleCreate() {
    const field = fieldName.trim()
    if (!field) {
      toast.error('请输入字段名')
      return
    }
    if (indexedSet.has(field)) {
      toast.error('该字段已有索引')
      return
    }
    try {
      await createIndex.mutateAsync({ field, schema: fieldType })
      toast.success(`已为「${field}」创建索引，后台构建中…`)
      setFieldName('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建索引失败')
    }
  }

  async function handleDelete() {
    if (!deleteField) return
    const field = deleteField
    setDeleteField(null)
    try {
      await deleteIndex.mutateAsync(field)
      toast.success(`已删除「${field}」的索引`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除索引失败')
    }
  }

  return (
    <>
      <Card padded className="space-y-4">
        <SectionTitle
          title="标量索引"
          desc="为标量字段建立索引以加快速度，注意排序仅支持整数、浮点数以及日期时间类型"
        />

        {indexed.length === 0 ? (
          <EmptyState title="暂无标量索引" desc="下方可为已有字段创建索引。" />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[420px] text-left text-[13px]">
              <thead className="border-b bg-surface-2 text-[12px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">字段</th>
                  <th className="px-3 py-2 font-medium">类型</th>
                  <th className="px-3 py-2 font-medium">点数</th>
                  <th className="px-3 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {indexed.map(([key, entry]) => {
                  const meta = entry as { data_type?: string; points?: number }
                  const dt = meta.data_type ?? '—'
                  return (
                    <tr key={key} className="border-b last:border-0">
                      <td className="px-3 py-2.5 font-mono text-ink">{key}</td>
                      <td className="px-3 py-2.5">
                        <Tag tone="neutral">{TYPE_LABEL[dt] ?? dt}</Tag>
                      </td>
                      <td className="px-3 py-2.5 tnum text-muted">
                        {meta.points != null ? formatInt(meta.points) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          title="删除索引"
                          aria-label={`删除 ${key} 索引`}
                          onClick={() => setDeleteField(key)}
                          className="inline-grid size-8 cursor-pointer place-items-center rounded-md text-muted transition hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                        >
                          <IconTrash className="text-[16px]" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t pt-4">
          <div className="mb-2 text-[12.5px] font-medium text-ink">创建索引</div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[10rem] flex-1">
              <span className="mb-1 block text-[12px] text-muted">字段名</span>
              <Input
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                list="payload-field-suggestions"
                placeholder="file_name"
                className="font-mono"
              />
              <datalist id="payload-field-suggestions">
                {suggestions.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </label>
            <label>
              <span className="mb-1 block text-[12px] text-muted">索引类型</span>
              <Select
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value)}
                className="min-w-[10rem]"
              >
                {INDEX_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                    {t.sortable ? ' · 可排序' : ''}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={createIndex.isPending}
              disabled={!fieldName.trim()}
            >
              创建索引
            </Button>
          </div>
          {sampleKeysQuery.data && sampleKeysQuery.data.length === 0 && (
            <p className="mt-2 text-[11.5px] text-muted">未采样到 payload 字段，可手动输入字段名。</p>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={!!deleteField}
        onOpenChange={(open) => !open && setDeleteField(null)}
        title={`删除索引 ${deleteField}`}
        message={
          <>
            确定删除字段 <span className="font-mono">{deleteField}</span> 的索引？
            <br />
            过滤与排序能力将受影响，该操作不可撤销。
          </>
        }
        confirmLabel="删除"
        danger
        loading={deleteIndex.isPending}
        onConfirm={handleDelete}
      />
    </>
  )
}
