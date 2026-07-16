import type { CSSProperties } from 'react'
import type { CollectionInfo, OptimizationTask, ProgressTree } from '../../lib/qdrant'
import {
  activeRunningTasks,
  buildSegmentBlocks,
  formatDurationSec,
  optimizerLabel,
  progressPercent,
  isStageActive,
  isStageDone,
  stageLabel,
} from '../../lib/optimizations'
import { useOptimizations } from '../../hooks/useQdrant'
import { QdrantError } from '../../lib/qdrant'
import { Card, EmptyState, SectionTitle, Tag } from '../ui/primitives'
import { formatInt } from '../../lib/format'
import { IconCheck } from '../ui/icons'

export function OptimizationProgressSection({
  name,
  info,
}: {
  name: string
  info: CollectionInfo
}) {
  const query = useOptimizations(name, info)
  const unsupported = query.error instanceof QdrantError && query.error.status === 404

  if (unsupported) {
    return (
      <Card padded>
        <SectionTitle title="优化进度" desc="当前 Qdrant 版本不支持优化进度 API（需 1.17+）" />
        <EmptyState title="无法获取进度" desc="请升级 Qdrant 后查看分段条带与阶段树。" />
      </Card>
    )
  }

  if (query.isLoading && !query.data) {
    return (
      <Card padded>
        <SectionTitle title="优化进度" desc="分段状态与后台任务阶段" />
        <div className="py-6 text-center text-[13px] text-muted">加载优化进度…</div>
      </Card>
    )
  }

  if (query.isError) {
    return (
      <Card padded>
        <SectionTitle title="优化进度" desc="分段状态与后台任务阶段" />
        <EmptyState
          title="加载失败"
          desc={query.error instanceof Error ? query.error.message : '未知错误'}
        />
      </Card>
    )
  }

  const data = query.data!
  const blocks = buildSegmentBlocks(data)
  const running = activeRunningTasks(data)
  const totalPoints = blocks.reduce((n, b) => n + b.pointsCount, 0) || 1

  return (
    <Card padded className="space-y-4">
      <SectionTitle
        title="优化进度"
        desc="分段状态与后台任务阶段"
        right={
          query.isFetching ? (
            <Tag tone="indigo">刷新中</Tag>
          ) : (
            <Tag tone="neutral">自动更新</Tag>
          )
        }
      />

      <div className="flex flex-wrap gap-3 text-[12px] text-muted">
        <span>排队任务 {formatInt(data.summary.queued_optimizations)}</span>
        <span>排队分段 {formatInt(data.summary.queued_segments)}</span>
        <span>排队点数 {formatInt(data.summary.queued_points)}</span>
        <span>空闲分段 {formatInt(data.summary.idle_segments)}</span>
      </div>

      <div>
        <div className="mb-2 text-[12px] font-medium text-ink">分段条带</div>
        {blocks.length === 0 ? (
          <EmptyState title="暂无分段信息" desc="集合中还没有可展示的分段。" />
        ) : (
          <>
            <div className="flex h-10 overflow-hidden rounded-lg border bg-surface-2">
              {blocks.map((block) => {
                const widthPct = Math.max(4, (block.pointsCount / totalPoints) * 100)
                const style = segmentStyle(block.state)
                return (
                  <div
                    key={block.id}
                    title={block.title}
                    className={`relative flex min-w-[28px] items-center justify-center overflow-hidden border-r border-white/30 px-1 text-[10px] font-medium last:border-r-0 ${style.className}`}
                    style={{ width: `${widthPct}%`, ...style.style }}
                  >
                    <span
                      className={`truncate drop-shadow-sm ${block.state === 'queued' ? 'text-muted' : 'text-white/95'}`}
                    >
                      {block.label}
                    </span>
                    {block.state === 'running' || block.state === 'building' ? (
                      <span className="opt-segment-pulse pointer-events-none absolute inset-0 bg-white/10" />
                    ) : null}
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
              <Legend color="var(--color-ok)" label="空闲" />
              <Legend color="var(--color-warn)" label="优化中" />
              <Legend color="var(--color-muted-soft)" label="排队" dashed />
              <Legend color="var(--color-indigo)" label="新建分段" />
            </div>
          </>
        )}
      </div>

      <div>
        <div className="mb-2 text-[12px] font-medium text-ink">阶段进度</div>
        {running.length === 0 ? (
          <div className="rounded-lg border bg-surface-2 px-3 py-2.5 text-[12.5px] text-muted">
            当前无进行中的优化
          </div>
        ) : (
          <div className="space-y-3">
            {running.map((task) => (
              <RunningTaskTree key={task.uuid} task={task} />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function RunningTaskTree({ task }: { task: OptimizationTask }) {
  return (
    <div className="rounded-lg border bg-surface-2 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-ink">{optimizerLabel(task.optimizer)}</span>
        <Tag tone="indigo">进行中</Tag>
        <span className="font-mono text-[11px] text-muted">{task.uuid.slice(0, 8)}</span>
        <span className="text-[11px] text-muted">
          源分段 {task.segments.length} · {formatInt(task.segments.reduce((n, s) => n + s.points_count, 0))} 点
        </span>
      </div>
      <ProgressTreeNode node={task.progress} depth={0} />
    </div>
  )
}

function ProgressTreeNode({ node, depth }: { node: ProgressTree; depth: number }) {
  const done = isStageDone(node)
  const active = isStageActive(node)
  const pct = progressPercent(node.done, node.total)

  return (
    <div style={{ marginLeft: depth ? 16 : 0 }}>
      <div className="flex items-center gap-2 py-1">
        <span className="grid size-4 shrink-0 place-items-center text-[11px]">
          {done ? (
            <IconCheck className="text-[var(--color-ok)]" />
          ) : active ? (
            <span className="size-2 rounded-full bg-[var(--color-warn)] animate-pulse" />
          ) : (
            <span className="size-2 rounded-full border border-[var(--color-line-strong)] bg-surface" />
          )}
        </span>
        <span className={`min-w-0 flex-1 text-[12.5px] ${active ? 'font-medium text-ink' : 'text-muted'}`}>
          {stageLabel(node.name)}
        </span>
        {pct != null ? (
          <span className="shrink-0 font-mono text-[11px] text-muted">
            {formatInt(node.done ?? 0)}/{formatInt(node.total ?? 0)}
          </span>
        ) : null}
        {node.duration_sec != null ? (
          <span className="shrink-0 font-mono text-[11px] text-muted-soft">
            {formatDurationSec(node.duration_sec)}
          </span>
        ) : null}
      </div>
      {pct != null ? (
        <div className="mb-1 ml-6 h-1.5 overflow-hidden rounded-full bg-[var(--color-line)]">
          <div
            className="h-full rounded-full bg-[var(--color-indigo)] transition-[width] duration-500"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      ) : null}
      {node.children?.map((child, i) => (
        <ProgressTreeNode key={`${node.name}-${i}`} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

function Legend({
  color,
  label,
  dashed,
}: {
  color: string
  label: string
  dashed?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-2.5 rounded-sm"
        style={
          dashed
            ? { border: `2px dashed ${color}`, background: 'transparent' }
            : { background: color }
        }
      />
      {label}
    </span>
  )
}

function segmentStyle(state: ReturnType<typeof buildSegmentBlocks>[number]['state']): {
  className: string
  style?: CSSProperties
} {
  switch (state) {
    case 'idle':
      return { className: '', style: { background: 'var(--color-ok)' } }
    case 'running':
      return { className: '', style: { background: 'var(--color-warn)' } }
    case 'queued':
      return {
        className: 'text-muted',
        style: {
          background: 'var(--color-surface)',
          borderTop: '2px dashed var(--color-muted-soft)',
          borderBottom: '2px dashed var(--color-muted-soft)',
          color: 'var(--color-muted)',
        },
      }
    case 'building':
      return { className: '', style: { background: 'var(--color-indigo)' } }
  }
}
