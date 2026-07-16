import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CollectionInfo, CollectionStatus, VectorParams } from '../../lib/qdrant'
import { useUpdateCollection, useOptimizations, useTriggerOptimizers } from '../../hooks/useQdrant'
import { useToast } from '../../components/ui/Toast'
import { Card, SectionTitle, Stat, Loading } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { Toggle } from '../../components/ui/fields'
import { formatInt } from '../../lib/format'
import { IconCheck, IconAlert, IconRefresh, IconSpinner } from '../../components/ui/icons'
import { PayloadIndexSection } from '../../components/collection/PayloadIndexSection'
import { OptimizationProgressSection } from '../../components/collection/OptimizationProgressSection'

interface VectorOnDiskEntry {
  name: string
  label: string
  onDisk: boolean
}

export function OptimizationsTab({ name, info }: { name: string; info: CollectionInfo }) {
  const toast = useToast()
  const update = useUpdateCollection(name)
  const trigger = useTriggerOptimizers(name)
  const optimizationsQuery = useOptimizations(name, info)

  const optimizerOk = info.optimizer_status === 'ok'
  const optimizerErr = typeof info.optimizer_status === 'object' ? info.optimizer_status.error : ''

  const queuedOptimizations = optimizationsQuery.data?.summary.queued_optimizations ?? 0
  const runningOptimizations = optimizationsQuery.data?.running.length ?? 0
  const needsManualTrigger =
    optimizerOk &&
    (info.status === 'grey' ||
      (queuedOptimizations > 0 && runningOptimizations === 0 && info.status !== 'green'))

  async function handleTriggerOptimizers() {
    if (!needsManualTrigger || trigger.isPending) return
    try {
      await trigger.mutateAsync()
      toast.success('已触发优化，后台任务将开始执行')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '触发失败')
    }
  }

  function optimizerTitle(): string {
    if (!optimizerOk) return '优化器出现异常'
    if (needsManualTrigger) return '优化器待唤醒'
    if (info.status === 'yellow') return '优化器运行中'
    return '优化器运行正常'
  }

  function optimizerStatusHint(): string {
    if (!optimizerOk) return optimizerErr
    if (needsManualTrigger) return '优化已暂停，点击左边按钮唤醒'
    if (info.status === 'green') return '所有分段已优化完成'
    return '正在后台优化分段…'
  }

  const [vectorOnDisk, setVectorOnDisk] = useState<VectorOnDiskEntry[]>([])
  const [hnswOnDisk, setHnswOnDisk] = useState(false)
  const [payloadOnDisk, setPayloadOnDisk] = useState(true)

  useEffect(() => {
    setVectorOnDisk(readVectorOnDisk(info))
    setHnswOnDisk(Boolean(info.config.hnsw_config?.on_disk))
    setPayloadOnDisk(info.config.params.on_disk_payload ?? true)
  }, [info])

  const dirty = useMemo(
    () => hasOnDiskChanges(info, vectorOnDisk, hnswOnDisk, payloadOnDisk),
    [info, vectorOnDisk, hnswOnDisk, payloadOnDisk],
  )

  function setVector(name: string, onDisk: boolean) {
    setVectorOnDisk((entries) =>
      entries.map((e) => (e.name === name ? { ...e, onDisk } : e)),
    )
  }

  async function save() {
    const body = buildOnDiskPatch(info, vectorOnDisk, hnswOnDisk, payloadOnDisk)
    if (!Object.keys(body).length) {
      toast.info('没有需要保存的改动')
      return
    }
    try {
      await update.mutateAsync(body)
      toast.success('存储策略已更新，segment 将在后台重建')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失败')
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <GroupHeader title="优化监控" desc="后台分段优化与索引进度，自动刷新" />
        <Card padded>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <OptimizerStatusBeacon
                status={info.status}
                optimizerOk={optimizerOk}
                needsManualTrigger={needsManualTrigger}
                loading={trigger.isPending}
                onTrigger={handleTriggerOptimizers}
              />
              <div>
                <div className="font-display text-[15px] font-semibold text-ink">
                  {optimizerTitle()}
                </div>
                <div className="text-[12.5px] text-muted">{optimizerStatusHint()}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <Stat label="分段数" value={info.segments_count} />
              <Stat label="已索引向量" value={formatInt(info.indexed_vectors_count)} />
              <Stat
                label="索引进度"
                value={pctIndexed(info)}
                accent={info.status === 'green' ? 'var(--color-ok)' : 'var(--color-warn)'}
              />
            </div>
          </div>
        </Card>

        <OptimizationProgressSection name={name} info={info} />
      </section>

      <section className="space-y-4">
        <GroupHeader title="集合配置" desc="索引与磁盘加载策略，保存后可能触发后台优化" />
        <PayloadIndexSection name={name} info={info} />

        <Card padded>
          <SectionTitle
            title="磁盘加载"
            desc="打开时加载于磁盘，关闭时加载于内存，内存和效率的选择"
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {vectorOnDisk.map((entry) => (
                <Toggle
                  key={entry.name || '__default__'}
                  checked={entry.onDisk}
                  onChange={(v) => setVector(entry.name, v)}
                  label={entry.label}
                />
              ))}
              <Toggle
                checked={hnswOnDisk}
                onChange={setHnswOnDisk}
                label="HNSW 索引加载于磁盘"
              />
              <Toggle
                checked={payloadOnDisk}
                onChange={setPayloadOnDisk}
                label="标量加载于磁盘"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {dirty && <span className="text-[12.5px] text-muted">有未保存的改动</span>}
              <Button
                variant="primary"
                onClick={save}
                loading={update.isPending}
                disabled={!dirty}
              >
                保存配置
              </Button>
            </div>
          </div>
        </Card>

        {update.isPending && <Loading label="正在下发配置…" />}
      </section>
    </div>
  )
}

function OptimizerStatusBeacon({
  status,
  optimizerOk,
  needsManualTrigger,
  loading,
  onTrigger,
}: {
  status: CollectionStatus
  optimizerOk: boolean
  needsManualTrigger: boolean
  loading: boolean
  onTrigger: () => void
}) {
  const visual = resolveOptimizerBeaconVisual(status, optimizerOk, needsManualTrigger, loading)
  const className = [
    'grid size-10 place-items-center rounded-xl text-lg text-white',
    visual.pulse ? 'opt-beacon-pulse' : '',
    visual.clickable ? 'opt-beacon-trigger' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (visual.clickable) {
    return (
      <button
        type="button"
        className={className}
        style={{ background: visual.background }}
        title="点击触发优化"
        aria-label="点击触发优化"
        onClick={onTrigger}
        disabled={loading}
      >
        {visual.icon}
      </button>
    )
  }

  return (
    <span className={className} style={{ background: visual.background }} aria-hidden="true">
      {visual.icon}
    </span>
  )
}

function resolveOptimizerBeaconVisual(
  status: CollectionStatus,
  optimizerOk: boolean,
  needsManualTrigger: boolean,
  loading: boolean,
): { background: string; icon: ReactNode; clickable: boolean; pulse: boolean } {
  if (!optimizerOk) {
    return {
      background: 'var(--color-danger)',
      icon: <IconAlert />,
      clickable: false,
      pulse: false,
    }
  }
  if (loading) {
    return {
      background: 'var(--color-warn)',
      icon: <IconSpinner />,
      clickable: false,
      pulse: false,
    }
  }
  if (needsManualTrigger) {
    return {
      background: 'var(--color-warn)',
      icon: <IconRefresh />,
      clickable: true,
      pulse: true,
    }
  }
  if (status === 'yellow') {
    return {
      background: 'var(--color-warn)',
      icon: <IconSpinner />,
      clickable: false,
      pulse: false,
    }
  }
  if (status === 'red') {
    return {
      background: 'var(--color-danger)',
      icon: <IconAlert />,
      clickable: false,
      pulse: false,
    }
  }
  if (status === 'grey') {
    return {
      background: 'var(--color-muted-soft)',
      icon: <IconRefresh />,
      clickable: false,
      pulse: false,
    }
  }
  return {
    background: 'var(--color-ok)',
    icon: <IconCheck />,
    clickable: false,
    pulse: false,
  }
}

function GroupHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="border-b pb-3">
      <h2 className="font-display text-[16px] font-semibold text-ink">{title}</h2>
      {desc && <p className="mt-0.5 text-[12.5px] text-muted">{desc}</p>}
    </div>
  )
}

function readVectorOnDisk(info: CollectionInfo): VectorOnDiskEntry[] {
  const vectors = info.config.params.vectors
  if (!vectors) return []

  if (isSingleVectorParams(vectors)) {
    return [
      {
        name: '',
        label: '向量加载于磁盘',
        onDisk: vectors.on_disk ?? false,
      },
    ]
  }

  return Object.entries(vectors).map(([vectorName, params]) => ({
    name: vectorName,
    label: `向量「${vectorName}」加载于磁盘`,
    onDisk: params.on_disk ?? false,
  }))
}

function hasOnDiskChanges(
  info: CollectionInfo,
  vectorOnDisk: VectorOnDiskEntry[],
  hnswOnDisk: boolean,
  payloadOnDisk: boolean,
): boolean {
  return Object.keys(buildOnDiskPatch(info, vectorOnDisk, hnswOnDisk, payloadOnDisk)).length > 0
}

function buildOnDiskPatch(
  info: CollectionInfo,
  vectorOnDisk: VectorOnDiskEntry[],
  hnswOnDisk: boolean,
  payloadOnDisk: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  const origVectors = readVectorOnDisk(info)

  const vectorsDiff: Record<string, { on_disk: boolean }> = {}
  for (const entry of vectorOnDisk) {
    const orig = origVectors.find((e) => e.name === entry.name)
    if (orig && orig.onDisk !== entry.onDisk) {
      vectorsDiff[entry.name] = { on_disk: entry.onDisk }
    }
  }
  if (Object.keys(vectorsDiff).length) body.vectors = vectorsDiff

  const origHnsw = Boolean(info.config.hnsw_config?.on_disk)
  if (hnswOnDisk !== origHnsw) body.hnsw_config = { on_disk: hnswOnDisk }

  const origPayload = info.config.params.on_disk_payload ?? true
  if (payloadOnDisk !== origPayload) body.params = { on_disk_payload: payloadOnDisk }

  return body
}

function isSingleVectorParams(v: VectorParams | Record<string, VectorParams>): v is VectorParams {
  return 'size' in v
}

function pctIndexed(info: CollectionInfo): string {
  const total = info.points_count || 0
  if (!total) return '—'
  const ratio = Math.min(1, (info.indexed_vectors_count || 0) / total)
  return `${(ratio * 100).toFixed(0)}%`
}
