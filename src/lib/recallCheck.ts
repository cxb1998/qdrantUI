import { qdrant } from './qdrant'

export const RECALL_SAMPLE_SIZE = 100

export interface RecallCheckOptions {
  limit?: number
  using?: string
  filter?: Record<string, unknown> | null
  params?: Record<string, unknown> | null
  timeout?: number
}

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000
}

/** 单点：精确检索 vs 近似检索，返回 recall@limit（对齐官方 check-index-precision.js） */
export async function checkIndexRecall(
  collectionName: string,
  pointId: string | number,
  options: RecallCheckOptions,
  log?: (msg: string) => void,
  idx?: number,
  total?: number,
): Promise<number | null> {
  const limit = options.limit ?? 10
  const vectorName = options.using ?? null
  const exclusionFilter = { must_not: [{ has_id: [pointId] }] }
  const queryFilter = options.filter
    ? { must: [options.filter, exclusionFilter] }
    : exclusionFilter

  const base: Record<string, unknown> = {
    limit,
    with_payload: false,
    with_vector: false,
    filter: queryFilter,
    query: pointId,
  }
  if (options.timeout != null) base.timeout = options.timeout
  if (vectorName) base.using = vectorName

  try {
    const exact = await qdrant.queryPointsTimed(collectionName, {
      ...base,
      params: { exact: true },
    })
    const exactMs = exact.serverMs

    const ann = await qdrant.queryPointsTimed(collectionName, {
      ...base,
      params: options.params ?? {},
    })
    const annMs = ann.serverMs

    const exactIds = exact.data.points.map((p) => p.id)
    const hnswIds = ann.data.points.map((p) => p.id)
    if (!exactIds.length) return null

    const recall = exactIds.filter((id) => hnswIds.includes(id)).length / exactIds.length

    if (log && idx != null && total != null) {
      const pct = `${(recall * 100).toFixed(1)}%`
      log(
        `第 ${idx + 1}/${total} 条（编号 ${pointId}）：吻合度 ${pct}（逐条比对 ${exactMs}ms；快速搜索 ${annMs}ms）`,
      )
    }
    return recall
  } catch (e) {
    console.error('检索评测跳过点', pointId, e)
    return null
  }
}

export interface RecallRunResult {
  avgRecall: number
  stdDev: number
  limit: number
  samples: number
}

/** scroll 采样（有 filter 时仅在筛选范围内），逐点 recommend 式 query 对比 exact / HNSW */
export async function runRecallBenchmark(
  collectionName: string,
  options: RecallCheckOptions,
  hooks?: {
    onProgress?: (done: number, total: number) => void
    log?: (msg: string) => void
    cancelRef?: { cancelled: boolean }
  },
): Promise<RecallRunResult | null> {
  const using = options.using ?? ''
  const limit = options.limit ?? 10
  const log = hooks?.log
  const hasFilter = Boolean(options.filter)

  const vectorLabel = using || '默认向量'

  if (hasFilter) {
    const { count } = await qdrant.countPointsByFilter(collectionName, options.filter!)
    if (count === 0) {
      log?.('筛选后没有数据，无法检测')
      return null
    }
    const sampleTarget = Math.min(count, RECALL_SAMPLE_SIZE)
    log?.(
      `符合筛选的有 ${count} 条，将抽取 ${sampleTarget} 条来检测（每次对比前 ${limit} 条结果）：${vectorLabel}`,
    )
  } else {
    log?.(
      `将从全部数据中抽取 ${RECALL_SAMPLE_SIZE} 条来检测（每次对比前 ${limit} 条结果）：${vectorLabel}`,
    )
  }

  const scrollBody: Record<string, unknown> = {
    limit: RECALL_SAMPLE_SIZE,
    with_payload: false,
    with_vector: false,
  }
  if (options.filter) scrollBody.filter = options.filter

  const scroll = await qdrant.scrollPoints(collectionName, scrollBody)

  const pointIds = scroll.points.map((p) => p.id)
  const total = pointIds.length

  if (total === 0) {
    log?.('没有拿到可用于检测的数据')
    return null
  }

  if (hasFilter && total < RECALL_SAMPLE_SIZE) {
    log?.(`符合筛选的数据只有 ${total} 条，已全部用于检测`)
  }

  const recalls: number[] = []

  for (let idx = 0; idx < total; idx++) {
    if (hooks?.cancelRef?.cancelled) break

    const recall = await checkIndexRecall(
      collectionName,
      pointIds[idx],
      { ...options, using },
      log,
      idx,
      total,
    )
    if (recall !== null && !Number.isNaN(recall)) recalls.push(recall)
    hooks?.onProgress?.(idx + 1, total)
  }

  if (!recalls.length) return null

  const avgRecall = round4(recalls.reduce((s, v) => s + v, 0) / recalls.length)
  const stdDev =
    recalls.length > 1
      ? round4(
          Math.sqrt(recalls.reduce((s, v) => s + (v - avgRecall) ** 2, 0) / (recalls.length - 1)),
        )
      : 0

  log?.(`平均吻合度（每次前 ${limit} 条）：${(avgRecall * 100).toFixed(2)}% ± ${(stdDev * 100).toFixed(2)}%`)

  return { avgRecall, stdDev, limit, samples: recalls.length }
}
