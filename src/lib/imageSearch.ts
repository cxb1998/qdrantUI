import { primaryVectorParams, qdrant, type CollectionInfo, type ScoredPoint } from './qdrant'
import type { PayloadFilterCondition } from './pointsFilter'
import { filtersToQdrantFilter } from './pointsFilter'

export function expectedVectorSize(info: CollectionInfo): number | null {
  return primaryVectorParams(info.config).size
}

export function primaryVectorName(info: CollectionInfo): string | undefined {
  const { named } = primaryVectorParams(info.config)
  return named[0]
}

/** 将 blob 预览转为 data URL，避免跨 Tab 导航后预览失效 */
export async function persistImagePreviewUrl(url: string): Promise<string> {
  if (!url.startsWith('blob:')) return url
  const res = await fetch(url)
  const blob = await res.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('读取预览图失败'))
    reader.readAsDataURL(blob)
  })
}

export async function queryByVector(
  collectionName: string,
  info: CollectionInfo,
  vector: number[],
  opts: {
    limit?: number
    offset?: number
    filters?: PayloadFilterCondition[]
    signal?: AbortSignal
  } = {},
): Promise<ScoredPoint[]> {
  const expected = expectedVectorSize(info)
  if (expected != null && vector.length !== expected) {
    throw new Error(`向量维度 ${vector.length} 与集合维度 ${expected} 不一致`)
  }

  const using = primaryVectorName(info)
  const payloadSchema = info.payload_schema ?? {}
  const filter = filtersToQdrantFilter(opts.filters ?? [], payloadSchema)

  const body: Record<string, unknown> = {
    query: vector,
    limit: opts.limit ?? 10,
    offset: opts.offset ?? 0,
    with_payload: true,
    with_vector: false,
  }
  if (using) body.using = using
  if (filter) body.filter = filter

  const res = await qdrant.queryPoints(collectionName, body, opts.signal)
  return res.points
}
