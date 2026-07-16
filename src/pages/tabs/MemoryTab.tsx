import { useMemo, useState, type ReactNode } from 'react'
import type { CollectionInfo, CollectionMemoryResponse } from '../../lib/qdrant'
import { QdrantError } from '../../lib/qdrant'
import { useCollectionMemory, useProcessMemoryMetrics } from '../../hooks/useQdrant'
import { Card, SectionTitle, Loading, ErrorState, EmptyState } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { formatBytes, formatInt } from '../../lib/format'
import { IconChevronRight, IconRefresh } from '../../components/ui/icons'

interface UsageValues {
  disk: number
  ram: number
  cached: number
  expected: number
}

interface DetailLeaf {
  type: 'leaf'
  key: string
  label: string
  usage: UsageValues
}

interface DetailGroup {
  type: 'group'
  key: string
  label: string
  usage: UsageValues
  children: DetailLeaf[]
}

interface DetailTotal {
  type: 'total'
  key: string
  label: string
  usage: UsageValues
}

type DetailNode = DetailTotal | DetailGroup | DetailLeaf

/** 磁盘明细行与构成分项横条同色 */
const DISK_BAR_COLOR: Record<string, string> = {
  total: 'var(--color-indigo)',
  vector: 'var(--color-seg-vector)',
  scalar: 'var(--color-seg-scalar)',
  'id-tracker': 'var(--color-seg-id)',
}

function diskBarColor(key: string): string {
  if (key.startsWith('sparse-')) return 'var(--color-seg-vector)'
  return DISK_BAR_COLOR[key] ?? 'var(--color-indigo-deep)'
}

interface BarSegment {
  label: string
  bytes: number
  color: string
}

export function MemoryTab({ name, info }: { name: string; info: CollectionInfo }) {
  const memoryQuery = useCollectionMemory(name)
  const processQuery = useProcessMemoryMetrics()

  const unsupported =
    memoryQuery.error instanceof QdrantError && memoryQuery.error.status === 404

  const detailTree = useMemo(
    () => (memoryQuery.data ? buildDetailTree(memoryQuery.data) : []),
    [memoryQuery.data],
  )

  const diskSegments = useMemo(
    () => (memoryQuery.data ? buildDiskSegments(memoryQuery.data) : []),
    [memoryQuery.data],
  )

  const currentMemorySegments = useMemo(() => {
    if (!memoryQuery.data) return []
    const { ram_bytes, cached_bytes } = memoryQuery.data.total
    return buildCurrentMemorySegments(ram_bytes, cached_bytes)
  }, [memoryQuery.data])

  async function refresh() {
    await Promise.all([memoryQuery.refetch(), processQuery.refetch()])
  }

  if (memoryQuery.isLoading && !memoryQuery.data) {
    return <Loading label="正在读取资源占用…" />
  }

  if (unsupported) {
    return (
      <EmptyState
        title="当前 Qdrant 版本不支持资源占用 API"
        desc="需要 Qdrant 1.18+ 的 GET /collections/{name}/memory 接口。"
      />
    )
  }

  if (memoryQuery.isError) {
    return (
      <ErrorState
        message={(memoryQuery.error as Error).message}
        onRetry={() => memoryQuery.refetch()}
      />
    )
  }

  const total = memoryQuery.data!.total
  const currentMemory = total.ram_bytes + total.cached_bytes
  const meta = `${formatInt(info.points_count)} 条数据 · ${info.segments_count} 个数据段`

  return (
    <div className="space-y-5">
      <p className="text-[12.5px] text-muted">{meta}</p>

      <Card padded>
        <SectionTitle
          title="磁盘占用"
          desc="该集合在硬盘上的存储情况"
          right={
            <Button
              variant="ghost"
              size="sm"
              icon={<IconRefresh />}
              onClick={refresh}
              loading={memoryQuery.isFetching || processQuery.isFetching}
            >
              刷新
            </Button>
          }
        />
        <div className="space-y-5">
          <ResourceMetric
            label="硬盘总占用"
            value={formatBytes(total.disk_bytes)}
            accent="var(--color-indigo)"
            hint="写入磁盘、持久保存的数据总量"
          />

          {diskSegments.length > 0 && (
            <div className="space-y-2">
              <div className="text-[12px] font-medium text-muted">构成分项</div>
              <MultiSegmentBar segments={diskSegments} />
            </div>
          )}

          <DetailTable
            tree={detailTree}
            total={total.disk_bytes}
            mode="disk"
            emptyLabel="暂无磁盘占用明细"
          />
        </div>
      </Card>

      <Card padded>
        <SectionTitle title="内存占用" desc="该集合运行时的内存情况" />
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <ResourceMetric
              label="当前占用"
              value={formatBytes(currentMemory)}
              accent="var(--color-indigo)"
              hint="当前集合此时占用的内存"
            />
            <ResourceMetric
              label="长期参考"
              value={formatBytes(total.expected_cache_bytes)}
              accent="var(--color-indigo-deep)"
              hint="数据充分加载、稳定运行后理论占用内存"
            />
          </div>

          {currentMemorySegments.length > 0 && (
            <div className="space-y-2">
              <div className="text-[12px] font-medium text-muted">当前占用构成</div>
              <MultiSegmentBar segments={currentMemorySegments} />
            </div>
          )}

          <DetailTable
            tree={detailTree}
            total={currentMemory}
            mode="memory"
            emptyLabel="暂无内存占用明细"
          />
        </div>
      </Card>

      {processQuery.data?.resident != null && (
        <p className="border-l-2 border-[var(--color-line-strong)] py-0.5 pl-3 text-[12px] leading-relaxed text-muted">
          以上仅统计当前集合。Qdrant 服务整体还占用约{' '}
          <span className="font-mono text-ink">{formatBytes(processQuery.data.resident)}</span>{' '}
          内存，包含其他集合与系统开销。
        </p>
      )}
    </div>
  )
}

/** 资源页专用指标卡：中文标签不用 uppercase，与全局 Stat 区分 */
function ResourceMetric({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: ReactNode
  hint?: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border bg-surface-2 px-4 py-3">
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div
        className="mt-1 font-display text-[22px] font-semibold leading-none tnum"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[11.5px] leading-snug text-muted-soft">{hint}</div>}
    </div>
  )
}

function DetailTable({
  tree,
  total,
  mode,
  emptyLabel,
}: {
  tree: DetailNode[]
  total: number
  mode: 'disk' | 'memory'
  emptyLabel: string
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const visibleTree = tree.filter((node) => isNodeVisible(node, mode))

  if (visibleTree.length === 0) {
    return <p className="text-[13px] text-muted">{emptyLabel}</p>
  }

  const onlyTotal =
    visibleTree.length === 1 &&
    visibleTree[0].type === 'total' &&
    !hasUsage(visibleTree[0].usage, mode)
  if (onlyTotal) {
    return <p className="text-[13px] text-muted">{emptyLabel}</p>
  }

  return (
    <div className="space-y-2">
      <div className="text-[12px] font-medium text-muted">分项明细</div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[480px] text-left text-[13px]">
          <thead className="border-b bg-surface-2 text-[12px] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">组件</th>
              {mode === 'disk' ? (
                <th className="px-3 py-2 font-medium">硬盘占用</th>
              ) : (
                <>
                  <th className="px-3 py-2 font-medium text-right">当前占用</th>
                  <th className="px-3 py-2 font-medium text-right">长期参考</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleTree.map((node) => {
              if (node.type === 'total') {
                return (
                  <DetailDataRow
                    key={node.key}
                    label={node.label}
                    usage={node.usage}
                    mode={mode}
                    total={total}
                    bold
                    barColor={mode === 'disk' ? diskBarColor(node.key) : undefined}
                  />
                )
              }

              if (node.type === 'group') {
                const open = expanded.has(node.key)
                return (
                  <GroupRows
                    key={node.key}
                    group={node}
                    open={open}
                    onToggle={() => toggle(node.key)}
                    mode={mode}
                    total={total}
                    barColor={mode === 'disk' ? diskBarColor(node.key) : undefined}
                  />
                )
              }

              return (
                <DetailDataRow
                  key={node.key}
                  label={node.label}
                  usage={node.usage}
                  mode={mode}
                  total={total}
                  bold
                  barColor={mode === 'disk' ? diskBarColor(node.key) : undefined}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupRows({
  group,
  open,
  onToggle,
  mode,
  total,
  barColor,
}: {
  group: DetailGroup
  open: boolean
  onToggle: () => void
  mode: 'disk' | 'memory'
  total: number
  barColor?: string
}) {
  return (
    <>
      <tr className="border-b">
        <td className="px-3 py-2">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-ink transition hover:text-[var(--color-indigo)]"
            aria-expanded={open}
          >
            <IconChevronRight
              className={`text-[15px] text-muted transition-transform ${open ? 'rotate-90' : ''}`}
            />
            {group.label}
          </button>
        </td>
        <DetailValueCells usage={group.usage} mode={mode} total={total} barColor={barColor} />
      </tr>
      {open &&
        group.children.map((child) => (
          <DetailDataRow
            key={child.key}
            label={child.label}
            usage={child.usage}
            mode={mode}
            total={total}
            indent
            barColor={barColor}
          />
        ))}
    </>
  )
}

function DetailDataRow({
  label,
  usage,
  mode,
  total,
  bold,
  indent,
  barColor,
}: {
  label: string
  usage: UsageValues
  mode: 'disk' | 'memory'
  total: number
  bold?: boolean
  indent?: boolean
  barColor?: string
}) {
  return (
    <tr className="border-b last:border-b-0">
      <td
        className={`px-3 py-2 text-ink ${indent ? 'pl-10 text-[12.5px] text-muted' : bold ? 'font-medium' : ''}`}
      >
        {label}
      </td>
      <DetailValueCells
        usage={usage}
        mode={mode}
        total={total}
        muted={indent}
        barColor={barColor}
      />
    </tr>
  )
}

function DetailValueCells({
  usage,
  mode,
  total,
  muted,
  barColor,
}: {
  usage: UsageValues
  mode: 'disk' | 'memory'
  total: number
  muted?: boolean
  barColor?: string
}) {
  if (mode === 'disk') {
    return (
      <ProportionCell
        bytes={usage.disk}
        total={total}
        muted={muted}
        color={barColor}
      />
    )
  }

  return (
    <>
      <td className="px-3 py-2 text-right font-mono text-[12.5px]">
        {formatBytes(usage.ram + usage.cached)}
      </td>
      <td className="px-3 py-2 text-right font-mono text-[12.5px]">
        {formatBytes(usage.expected)}
      </td>
    </>
  )
}

function isNodeVisible(node: DetailNode, mode: 'disk' | 'memory'): boolean {
  if (node.type === 'total') return true
  if (node.type === 'group') return true
  if (mode === 'disk') return node.usage.disk > 0
  return hasUsage(node.usage, mode)
}

function hasUsage(usage: UsageValues, mode: 'disk' | 'memory'): boolean {
  if (mode === 'disk') return usage.disk > 0
  return usage.ram + usage.cached > 0 || usage.expected > 0
}

function ProportionCell({
  bytes,
  total,
  muted,
  color = 'var(--color-indigo)',
}: {
  bytes: number
  total: number
  muted?: boolean
  color?: string
}) {
  const pct = total > 0 ? (bytes / total) * 100 : 0
  return (
    <td className="px-3 py-2">
      <div className="flex min-w-[140px] items-center gap-2.5">
        <div className="h-1.5 min-w-[56px] flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
          {bytes > 0 && (
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(pct, 2)}%`,
                background: color,
                opacity: muted ? 0.55 : 1,
              }}
            />
          )}
        </div>
        <span className="shrink-0 font-mono text-[12.5px] text-ink">{formatBytes(bytes)}</span>
      </div>
    </td>
  )
}

function buildDetailTree(data: CollectionMemoryResponse): DetailNode[] {
  const nodes: DetailNode[] = [
    {
      type: 'total',
      key: 'total',
      label: '合计',
      usage: usageFromApi(data.total),
    },
  ]

  const vectorChildren: DetailLeaf[] = []
  for (const vector of data.vectors) {
    const prefix = vector.name ? `向量 · ${vector.name}` : '向量'
    vectorChildren.push({
      type: 'leaf',
      key: `${prefix}-data`,
      label: `${prefix} · 数据`,
      usage: usageFromApi(vector.storage),
    })
    vectorChildren.push({
      type: 'leaf',
      key: `${prefix}-index`,
      label: `${prefix} · 索引`,
      usage: usageFromApi(vector.index),
    })
  }
  if (vectorChildren.length > 0) {
    nodes.push({
      type: 'group',
      key: 'vector',
      label: '向量',
      usage: sumUsage(vectorChildren.map((c) => c.usage)),
      children: vectorChildren,
    })
  }

  for (const sparse of data.sparse_vectors ?? []) {
    const prefix = sparse.name ? `稀疏向量 · ${sparse.name}` : '稀疏向量'
    const children: DetailLeaf[] = [
      {
        type: 'leaf',
        key: `${prefix}-data`,
        label: `${prefix} · 数据`,
        usage: usageFromApi(sparse.storage),
      },
      {
        type: 'leaf',
        key: `${prefix}-index`,
        label: `${prefix} · 索引`,
        usage: usageFromApi(sparse.index),
      },
    ]
    nodes.push({
      type: 'group',
      key: `sparse-${sparse.name || 'default'}`,
      label: prefix,
      usage: sumUsage(children.map((c) => c.usage)),
      children,
    })
  }

  const scalarData = usageFromApi(data.payload)
  const scalarIndex = sumUsage(
    (data.payload_index ?? []).map((index) => usageFromApi(index.usage)),
  )
  nodes.push({
    type: 'group',
    key: 'scalar',
    label: '标量',
    usage: sumUsage([scalarData, scalarIndex]),
    children: [
      {
        type: 'leaf',
        key: 'scalar-data',
        label: '标量 · 数据',
        usage: scalarData,
      },
      {
        type: 'leaf',
        key: 'scalar-index',
        label: '标量 · 索引',
        usage: scalarIndex,
      },
    ],
  })

  const idTracker = data.other?.id_tracker
  if (idTracker) {
    nodes.push({
      type: 'leaf',
      key: 'id-tracker',
      label: '编号对照',
      usage: usageFromApi(idTracker),
    })
  }

  return nodes
}

function usageFromApi(usage: {
  disk_bytes: number
  ram_bytes: number
  cached_bytes: number
  expected_cache_bytes: number
}): UsageValues {
  return {
    disk: usage.disk_bytes,
    ram: usage.ram_bytes,
    cached: usage.cached_bytes,
    expected: usage.expected_cache_bytes,
  }
}

function sumUsage(usages: UsageValues[]): UsageValues {
  return usages.reduce(
    (acc, u) => ({
      disk: acc.disk + u.disk,
      ram: acc.ram + u.ram,
      cached: acc.cached + u.cached,
      expected: acc.expected + u.expected,
    }),
    { disk: 0, ram: 0, cached: 0, expected: 0 },
  )
}

function buildDiskSegments(data: CollectionMemoryResponse): BarSegment[] {
  let vectors = 0
  for (const vector of data.vectors) {
    vectors += vector.storage.disk_bytes + vector.index.disk_bytes
  }
  for (const sparse of data.sparse_vectors ?? []) {
    vectors += sparse.storage.disk_bytes + sparse.index.disk_bytes
  }

  let scalar = data.payload.disk_bytes
  for (const index of data.payload_index ?? []) {
    scalar += index.usage.disk_bytes
  }

  const idTracker = data.other?.id_tracker?.disk_bytes ?? 0

  const segments: BarSegment[] = []
  pushSegment(segments, '向量', vectors, 'var(--color-seg-vector)')
  pushSegment(segments, '标量', scalar, 'var(--color-seg-scalar)')
  pushSegment(segments, '编号对照', idTracker, 'var(--color-seg-id)')
  return segments
}

function buildCurrentMemorySegments(ram: number, cached: number): BarSegment[] {
  const segments: BarSegment[] = []
  pushSegment(segments, '直接加载', ram, 'var(--color-seg-ram)')
  pushSegment(segments, '文件缓存', cached, 'var(--color-seg-cache)')
  return segments
}

function pushSegment(segments: BarSegment[], label: string, bytes: number, color: string) {
  if (bytes > 0) segments.push({ label, bytes, color })
}

function MultiSegmentBar({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((sum, seg) => sum + seg.bytes, 0) || 1
  return (
    <div className="space-y-2.5">
      <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-[var(--color-line)] p-0.5">
        {segments.map((seg) => (
          <span
            key={seg.label}
            title={`${seg.label}: ${formatBytes(seg.bytes)}`}
            className="min-w-[3px] rounded-[3px] transition-[flex-grow]"
            style={{
              flexGrow: seg.bytes,
              flexBasis: 0,
              background: seg.color,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12px]">
        {segments.map((seg) => (
          <Legend
            key={seg.label}
            color={seg.color}
            label={seg.label}
            value={formatBytes(seg.bytes)}
            pct={(seg.bytes / total) * 100}
          />
        ))}
      </div>
    </div>
  )
}

function Legend({
  color,
  label,
  value,
  pct,
}: {
  color: string
  label: string
  value: string
  pct: number
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
      {label}
      <span className="font-mono text-ink">{value}</span>
      <span className="text-muted-soft tnum">({pct.toFixed(0)}%)</span>
    </span>
  )
}
