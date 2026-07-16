import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { qdrant } from '../../lib/qdrant'
import { buildFilterInputFromConditions, type PayloadFilterCondition } from '../../lib/pointsFilter'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Field, Input, Textarea } from '../ui/fields'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'
import { formatInt } from '../../lib/format'
import { qk } from '../../hooks/useQdrant'

type BatchMode = 'set' | 'delete-keys' | 'delete-points'

function parseFieldValue(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed)
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number(trimmed)
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return JSON.parse(trimmed)
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseDeleteKeys(raw: string): string[] {
  return [...new Set(raw.split(/[\n,]+/).map((k) => k.trim()).filter(Boolean))]
}

export function BatchPayloadDialog({
  open,
  onOpenChange,
  collectionName,
  filters,
  qdrantFilter,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionName: string
  filters: PayloadFilterCondition[]
  qdrantFilter: Record<string, unknown> | null | undefined
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const [mode, setMode] = useState<BatchMode>('set')
  const [fieldKey, setFieldKey] = useState('')
  const [fieldValue, setFieldValue] = useState('')
  const [deleteKeys, setDeleteKeys] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  const scopeLabel = useMemo(() => {
    if (filters.length) return buildFilterInputFromConditions(filters)
    return '全部实例（无过滤条件）'
  }, [filters])

  const countQuery = useQuery({
    queryKey: ['batch-payload-count', collectionName, qdrantFilter],
    queryFn: ({ signal }) => qdrant.countPointsByFilter(collectionName, qdrantFilter ?? null, signal),
    enabled: open,
  })

  useEffect(() => {
    if (!open) {
      setMode('set')
      setFieldKey('')
      setFieldValue('')
      setDeleteKeys('')
      setError('')
      setConfirmOpen(false)
      setPendingCount(null)
    }
  }, [open])

  function validate(): boolean {
    setError('')
    if (mode === 'set') {
      if (!fieldKey.trim()) {
        setError('请输入标量名')
        return false
      }
      if (!fieldValue.trim()) {
        setError('请输入标量值')
        return false
      }
      try {
        parseFieldValue(fieldValue)
      } catch {
        setError('标量值不是合法 JSON')
        return false
      }
    } else if (mode === 'delete-keys') {
      if (!parseDeleteKeys(deleteKeys).length) {
        setError('请输入至少一个要删除的标量名')
        return false
      }
    }
    return true
  }

  async function requestConfirm() {
    if (!validate()) return
    const count = countQuery.data?.count
    if (count == null) {
      toast.error('无法获取匹配实例数，请稍后重试')
      return
    }
    if (count === 0) {
      toast.info('当前过滤条件下没有匹配的实例')
      return
    }
    setPendingCount(count)
    setConfirmOpen(true)
  }

  async function apply() {
    if (!validate()) return
    setLoading(true)
    try {
      const target = { filter: qdrantFilter ?? {} }
      const affected = pendingCount ?? countQuery.data?.count ?? 0

      if (mode === 'set') {
        const value = parseFieldValue(fieldValue)
        await qdrant.setPayload(collectionName, { [fieldKey.trim()]: value }, target)
        toast.success(`已为 ${formatInt(affected)} 个实例写入标量「${fieldKey.trim()}」`)
      } else if (mode === 'delete-keys') {
        const keys = parseDeleteKeys(deleteKeys)
        await qdrant.deletePayloadKeys(collectionName, keys, target)
        toast.success(`已从 ${formatInt(affected)} 个实例删除 ${keys.length} 个标量`)
      } else {
        await qdrant.deletePointsByFilter(collectionName, qdrantFilter ?? null)
        toast.success(`已删除 ${formatInt(affected)} 个实例`)
      }

      await qc.invalidateQueries({ queryKey: qk.collection(collectionName) })
      await qc.invalidateQueries({ queryKey: ['points', collectionName] })
      await qc.invalidateQueries({ queryKey: ['points-similar', collectionName] })
      await qc.invalidateQueries({ queryKey: ['points-image', collectionName] })
      await qc.invalidateQueries({ queryKey: ['payload-keys', collectionName] })
      await qc.invalidateQueries({ queryKey: ['batch-payload-count', collectionName] })
      setConfirmOpen(false)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '批量操作失败')
    } finally {
      setLoading(false)
    }
  }

  const matchedCount = countQuery.data?.count
  const isDangerMode = mode === 'delete-keys' || mode === 'delete-points'

  const confirmTitle =
    mode === 'set'
      ? '确认批量写入'
      : mode === 'delete-keys'
        ? '确认批量删除标量'
        : '确认批量删除实例'

  const confirmLabel =
    mode === 'set' ? '确认写入' : mode === 'delete-keys' ? '确认删除标量' : '确认删除实例'

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="批量修改"
        description="对过滤条件下的所有匹配实例生效（不仅是当前页）"
        width={520}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              取消
            </Button>
            <Button variant="primary" onClick={requestConfirm} loading={loading || countQuery.isLoading}>
              预览并执行
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border bg-surface-2 px-3 py-2.5 text-[12.5px]">
            <div className="text-muted">作用范围</div>
            <div className="mt-0.5 font-mono text-ink">{scopeLabel}</div>
            <div className="mt-1.5 text-muted">
              匹配实例数：
              {countQuery.isLoading ? '计算中…' : countQuery.isError ? '—' : formatInt(matchedCount ?? 0)}
            </div>
            {!filters.length && (
              <p className="mt-2 text-[11.5px] text-[var(--color-warn)]">
                未设置过滤条件，将对集合内全部实例生效。
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={mode === 'set' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode('set')}
            >
              添加 / 更新标量
            </Button>
            <Button
              variant={mode === 'delete-keys' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode('delete-keys')}
            >
              删除标量
            </Button>
            <Button
              variant={mode === 'delete-points' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode('delete-points')}
            >
              删除实例
            </Button>
          </div>

          {mode === 'set' ? (
            <div className="space-y-3">
              <Field label="标量名" hint="写入或覆盖该标量的值，其它标量不受影响">
                <Input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} spellCheck={false} />
              </Field>
              <Field
                label="标量值"
                hint="支持字符串、数字、布尔、null；对象/数组请写 JSON"
              >
                <Input
                  value={fieldValue}
                  onChange={(e) => setFieldValue(e.target.value)}
                  placeholder='例如 true、123、"文本" 或 {"k":"v"}'
                  className="font-mono"
                  spellCheck={false}
                />
              </Field>
            </div>
          ) : mode === 'delete-keys' ? (
            <Field label="要删除的标量名" hint="多个标量用逗号或换行分隔">
              <Textarea
                value={deleteKeys}
                onChange={(e) => setDeleteKeys(e.target.value)}
                rows={4}
                placeholder="field_a, field_b"
                className="font-mono text-[12.5px]"
                spellCheck={false}
              />
            </Field>
          ) : (
            <div className="rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3 py-2.5 text-[12.5px] text-ink">
              <p className="font-medium text-[var(--color-danger)]">永久删除匹配的实例</p>
              <p className="mt-1 text-muted">
                将删除向量和全部标量，不可撤销。建议先设置过滤条件缩小范围，确认匹配实例数后再执行。
              </p>
            </div>
          )}

          {error && <p className="text-[12px] text-[var(--color-danger)]">{error}</p>}
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmTitle}
        danger={isDangerMode}
        loading={loading}
        confirmLabel={confirmLabel}
        message={
          mode === 'set' ? (
            <>
              将为 <strong>{formatInt(pendingCount ?? 0)}</strong> 个实例写入
              <br />
              <span className="font-mono text-[13px]">
                {fieldKey.trim()} = {fieldValue.trim()}
              </span>
            </>
          ) : mode === 'delete-keys' ? (
            <>
              将从 <strong>{formatInt(pendingCount ?? 0)}</strong> 个实例删除标量
              <br />
              <span className="font-mono text-[13px]">{parseDeleteKeys(deleteKeys).join(', ')}</span>
            </>
          ) : (
            <>
              将永久删除 <strong>{formatInt(pendingCount ?? 0)}</strong> 个实例（含向量与标量）。
              <br />
              <span className="mt-2 block font-mono text-[13px] text-muted">{scopeLabel}</span>
              {!filters.length && (
                <span className="mt-2 block text-[13px] text-[var(--color-danger)]">
                  未设置过滤条件，将删除集合内全部实例。
                </span>
              )}
            </>
          )
        }
        onConfirm={apply}
      />
    </>
  )
}
