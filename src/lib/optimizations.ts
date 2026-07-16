import type {
  OptimizationSegmentInfo,
  OptimizationTask,
  OptimizationsResponse,
  ProgressTree,
} from './qdrant'
import { formatInt } from './format'

export type SegmentBlockState = 'running' | 'queued' | 'idle' | 'building'

export interface SegmentBlock {
  id: string
  state: SegmentBlockState
  pointsCount: number
  label: string
  title: string
  optimizer?: string
}

const OPTIMIZER_LABEL: Record<string, string> = {
  indexing: '索引构建',
  merge: '分段合并',
  vacuum: '整理清理',
  config_mismatch: '配置对齐',
  segment_builder: '分段构建',
}

const STAGE_LABEL: Record<string, string> = {
  copy_data: '复制数据',
  populate_vector_storages: '写入向量',
  populate_vectors: '写入向量',
  payload_index: '标量索引',
  vector_index: '向量索引',
  main_graph: 'HNSW 主图',
  additional_links: '附加链接',
  flush: '刷盘',
}

export function optimizerLabel(name: string): string {
  return OPTIMIZER_LABEL[name] ?? name
}

export function stageLabel(name: string): string {
  return STAGE_LABEL[name] ?? name.replaceAll('_', ' ')
}

export function formatDurationSec(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec)) return '—'
  if (sec < 1) return `${(sec * 1000).toFixed(0)} ms`
  if (sec < 60) return `${sec.toFixed(1)} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m} m ${s.toFixed(0)} s`
}

export function progressPercent(done?: number | null, total?: number | null): number | null {
  if (done == null || total == null || total <= 0) return null
  return Math.min(1, done / total)
}

export function isStageDone(node: ProgressTree): boolean {
  return Boolean(node.finished_at) || (node.duration_sec != null && !node.started_at)
}

export function isStageActive(node: ProgressTree): boolean {
  if (isStageDone(node)) return false
  return Boolean(node.started_at) || node.done != null
}

export function buildSegmentBlocks(data: OptimizationsResponse): SegmentBlock[] {
  const runningIds = new Set<string>()
  const queuedIds = new Set<string>()
  const blocks: SegmentBlock[] = []

  for (const task of data.running ?? []) {
    blocks.push({
      id: `build:${task.uuid}`,
      state: 'building',
      pointsCount: sumPoints(task.segments),
      label: '新建',
      title: `${optimizerLabel(task.optimizer)} · 目标分段 ${task.uuid.slice(0, 8)}`,
      optimizer: task.optimizer,
    })
    for (const seg of task.segments) {
      runningIds.add(seg.uuid)
      blocks.push({
        id: seg.uuid,
        state: 'running',
        pointsCount: seg.points_count,
        label: formatInt(seg.points_count),
        title: `优化中 · ${seg.uuid.slice(0, 8)} · ${formatInt(seg.points_count)} 点 · ${optimizerLabel(task.optimizer)}`,
        optimizer: task.optimizer,
      })
    }
  }

  for (const item of data.queued ?? []) {
    for (const seg of item.segments) {
      if (runningIds.has(seg.uuid)) continue
      if (queuedIds.has(seg.uuid)) continue
      queuedIds.add(seg.uuid)
      blocks.push({
        id: seg.uuid,
        state: 'queued',
        pointsCount: seg.points_count,
        label: formatInt(seg.points_count),
        title: `排队中 · ${seg.uuid.slice(0, 8)} · ${formatInt(seg.points_count)} 点 · ${optimizerLabel(item.optimizer)}`,
        optimizer: item.optimizer,
      })
    }
  }

  for (const seg of data.idle_segments ?? []) {
    if (runningIds.has(seg.uuid) || queuedIds.has(seg.uuid)) continue
    blocks.push({
      id: seg.uuid,
      state: 'idle',
      pointsCount: seg.points_count,
      label: formatInt(seg.points_count),
      title: `空闲 · ${seg.uuid.slice(0, 8)} · ${formatInt(seg.points_count)} 点`,
    })
  }

  return blocks
}

export function activeRunningTasks(data: OptimizationsResponse | undefined): OptimizationTask[] {
  return (data?.running ?? []).filter((t) => t.status === 'optimizing')
}

export function hasActiveOptimization(
  data: OptimizationsResponse | undefined,
  collectionStatus: string,
): boolean {
  if ((data?.running?.length ?? 0) > 0) return true
  if ((data?.summary?.queued_optimizations ?? 0) > 0) return true
  return collectionStatus === 'yellow'
}

function sumPoints(segments: OptimizationSegmentInfo[]): number {
  return segments.reduce((n, s) => n + s.points_count, 0)
}
