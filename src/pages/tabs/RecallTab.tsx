import { useMemo, useRef, useState } from 'react'
import type { CollectionInfo } from '../../lib/qdrant'
import { listDenseVectors } from '../../lib/qdrant'
import {
  filtersToQdrantFilter,
  type PayloadFilterCondition,
} from '../../lib/pointsFilter'
import { runRecallBenchmark, type RecallCheckOptions } from '../../lib/recallCheck'
import { PayloadFilterField } from '../../components/points/PayloadFilterField'
import { Card, SectionTitle, EmptyState } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/fields'
import { useToast } from '../../components/ui/Toast'
import { distanceLabel, formatPercent } from '../../lib/format'
import { IconChevronRight, IconTarget } from '../../components/ui/icons'

function readDefaultEf(info: CollectionInfo): number {
  const ef = info.config.hnsw_config?.ef_construct
  return typeof ef === 'number' && ef > 0 ? ef : 128
}

export function RecallTab({ name, info }: { name: string; info: CollectionInfo }) {
  const toast = useToast()
  const vectors = useMemo(() => listDenseVectors(info.config), [info.config])
  const payloadSchema = info.payload_schema ?? {}

  const [optionsOpen, setOptionsOpen] = useState(false)
  const [topK, setTopK] = useState(10)
  const [hnswEf, setHnswEf] = useState(() => readDefaultEf(info))
  const [filters, setFilters] = useState<PayloadFilterCondition[]>([])

  const [recall, setRecall] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(vectors.map((v) => [v.name, null])),
  )
  const [inProgressVector, setInProgressVector] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [log, setLog] = useState('')
  const cancelRef = useRef({ cancelled: false })

  const running = inProgressVector !== null

  const qdrantFilter = useMemo(
    () => filtersToQdrantFilter(filters, payloadSchema),
    [filters, payloadSchema],
  )

  const optionsSummary = useMemo(() => {
    const parts = [`返回 ${topK} 条`, `精细度 ${hnswEf}`]
    if (filters.length) parts.push(`${filters.length} 个筛选`)
    return parts.join(' · ')
  }, [topK, hnswEf, filters.length])

  function buildCheckOptions(using: string): RecallCheckOptions {
    const opts: RecallCheckOptions = { using, limit: topK }
    const filter = qdrantFilter as Record<string, unknown> | null
    if (filter) opts.filter = filter
    if (hnswEf > 0) opts.params = { hnsw_ef: hnswEf }
    return opts
  }

  function appendLog(msg: string) {
    const ts = new Date().toLocaleString('zh-CN', { hour12: false })
    setLog((prev) => `[${ts}] ${msg}\n${prev}`)
  }

  function clearLogs() {
    setLog('')
  }

  async function onCheckIndexQuality(params: RecallCheckOptions) {
    const using = params.using ?? ''
    cancelRef.current.cancelled = false
    setInProgressVector(using)
    setProgress(0)
    clearLogs()

    try {
      const result = await runRecallBenchmark(name, params, {
        onProgress: (done, total) => setProgress(Math.round((done / total) * 100)),
        log: appendLog,
        cancelRef: cancelRef.current,
      })

      if (cancelRef.current.cancelled) {
        appendLog('检测已停止')
        return
      }

      if (!result) {
        toast.error('检测未完成，请确认集合里有数据，且搜索索引已就绪')
        return
      }

      setRecall((prev) => ({ ...prev, [using]: result.avgRecall }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : '检测失败'
      toast.error(msg)
      appendLog(msg)
    } finally {
      setInProgressVector(null)
      setProgress(0)
    }
  }

  function cancel() {
    cancelRef.current.cancelled = true
  }

  if (!vectors.length) {
    return (
      <EmptyState title="暂不支持检测" desc="这个集合还没有可用的向量数据，无法进行检索评测。" />
    )
  }

  return (
    <div className="space-y-4">
      <Card padded>
        <SectionTitle
          title="检索评测"
          desc="随机抽一批数据，看「快速搜索」和「逐条比对」的结果有多一致。百分比越高，说明快速搜索越可靠。"
        />

        <div className="mb-4 rounded-lg border">
          <button
            type="button"
            onClick={() => setOptionsOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition hover:bg-surface-2"
            aria-expanded={optionsOpen}
          >
            <IconChevronRight
              className={`shrink-0 text-base text-muted transition-transform ${optionsOpen ? 'rotate-90' : ''}`}
            />
            <span className="text-[13px] font-medium text-ink">检测设置</span>
            {!optionsOpen && (
              <span className="truncate text-[12px] text-muted">{optionsSummary}</span>
            )}
          </button>

          {optionsOpen && (
            <div className="space-y-3 border-t px-3 py-3">
              <div className="flex flex-wrap items-end gap-4">
                <NumField
                  label="每次返回几条"
                  value={topK}
                  min={1}
                  max={100}
                  onChange={setTopK}
                  hint="一次搜索最多展示多少条相似结果"
                />
                <NumField
                  label="搜索精细度"
                  value={hnswEf}
                  min={topK}
                  max={4096}
                  onChange={setHnswEf}
                  hint="数值越大结果越准，但会更慢"
                />
              </div>
              <Field
                label="筛选条件"
                hint="写法与「数据管理」相同，按 Enter 确认。不填则在全部数据中检测；有筛选时只在符合条件的数据中检测"
              >
                <PayloadFilterField
                  collectionName={name}
                  filters={filters}
                  onFiltersChange={setFilters}
                  payloadSchema={payloadSchema}
                />
              </Field>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="border-b bg-surface-2 text-[12px] text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">名称</th>
                <th className="px-3 py-2 font-medium">维度</th>
                <th className="px-3 py-2 font-medium">相似度算法</th>
                <th className="px-3 py-2 font-medium">吻合度</th>
                <th className="px-3 py-2 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {vectors.map((v) => {
                const isThis = inProgressVector === v.name
                const disabled = running && !isThis
                const value = recall[v.name]

                return (
                  <tr key={v.name || '__default__'} className="border-b last:border-b-0">
                    <td className="px-3 py-2.5 font-medium text-ink">{v.displayName}</td>
                    <td className="px-3 py-2.5 font-mono tnum text-muted">{v.size}</td>
                    <td className="px-3 py-2.5 text-muted">{distanceLabel(v.distance)}</td>
                    <td className="px-3 py-2.5 font-mono tnum">
                      {isThis ? (
                        <span className="text-muted">检测中…</span>
                      ) : value != null ? (
                        <span className="text-ink">{formatPercent(value, 2)}</span>
                      ) : (
                        <span className="text-muted-soft">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<IconTarget />}
                        loading={isThis}
                        disabled={disabled}
                        onClick={() => onCheckIndexQuality(buildCheckOptions(v.name))}
                      >
                        开始检测
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {running && (
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
            <div
              className="h-full rounded-full bg-[var(--color-indigo)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <Button variant="danger" size="sm" onClick={cancel}>
            停止（{progress}%）
          </Button>
        </div>
      )}

      {(log || running) && (
        <Card padded>
          <SectionTitle title="检测记录" desc="每条数据的对比结果与最终汇总" />
          <Textarea
            readOnly
            rows={12}
            value={log || (running ? '正在记录…' : '')}
            className="text-[12px] text-muted"
          />
        </Card>
      )}

      {!running && !log && (
        <EmptyState
          title="尚未检测"
          desc="点击「开始检测」即可。如需限定数据范围或调整返回条数，可先展开「检测设置」。"
        />
      )}
    </div>
  )
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="w-28 font-mono"
      />
      {hint && <span className="mt-1 block text-[11px] text-muted-soft">{hint}</span>}
    </label>
  )
}
