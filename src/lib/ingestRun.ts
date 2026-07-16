import { embedImage } from './embed'
import {
  buildPayloadFromMappings,
  generateIngestPointId,
  ingestFileContext,
  mergeIngestPayload,
  type ScalarMapping,
} from './ingestMapping'
import { primaryVectorName, expectedVectorSize } from './imageSearch'
import { qdrant, type CollectionInfo, type PointStruct } from './qdrant'

export interface IngestProgress {
  phase: 'embedding' | 'upserting' | 'done' | 'error'
  done: number
  total: number
  message?: string
}

export function buildPointStruct(
  info: CollectionInfo,
  id: string | number,
  vector: number[],
  payload: Record<string, unknown>,
): PointStruct {
  const vectorName = primaryVectorName(info)
  return {
    id,
    payload,
    vector: vectorName ? { [vectorName]: vector } : vector,
  }
}

export async function ingestSinglePoint(opts: {
  collectionName: string
  info: CollectionInfo
  file: File
  mappings: ScalarMapping[]
  payloadOverrides?: Record<string, string>
  signal?: AbortSignal
}): Promise<PointStruct> {
  const dim = expectedVectorSize(opts.info)
  const ctx = ingestFileContext(opts.file)
  const embedded = await embedImage(opts.file, dim ?? undefined, opts.signal)
  const schema = opts.info.payload_schema ?? {}
  const localPayload = buildPayloadFromMappings(
    opts.mappings,
    ctx,
    opts.payloadOverrides,
    schema,
  )
  const payload = mergeIngestPayload(localPayload, embedded.payload, schema)
  const id = generateIngestPointId()
  return buildPointStruct(opts.info, id, embedded.vector, payload)
}

export async function runBatchIngest(opts: {
  collectionName: string
  info: CollectionInfo
  files: File[]
  mappings: ScalarMapping[]
  onProgress?: (p: IngestProgress) => void
  signal?: AbortSignal
  embedConcurrency?: number
  upsertBatchSize?: number
}): Promise<{ succeeded: number; failed: number; errors: string[] }> {
  const dim = expectedVectorSize(opts.info)
  const total = opts.files.length
  const errors: string[] = []
  const points: PointStruct[] = []
  const concurrency = opts.embedConcurrency ?? 3
  let done = 0

  opts.onProgress?.({ phase: 'embedding', done: 0, total })

  await mapWithConcurrency(
    opts.files,
    async (file) => {
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const ctx = ingestFileContext(file)
      try {
        const embedded = await embedImage(file, dim ?? undefined, opts.signal)
        const schema = opts.info.payload_schema ?? {}
        const localPayload = buildPayloadFromMappings(opts.mappings, ctx, undefined, schema)
        const payload = mergeIngestPayload(localPayload, embedded.payload, schema)
        const id = generateIngestPointId()
        points.push(buildPointStruct(opts.info, id, embedded.vector, payload))
      } catch (e) {
        errors.push(`${ctx.relativePath}: ${e instanceof Error ? e.message : '向量化失败'}`)
      } finally {
        done += 1
        opts.onProgress?.({ phase: 'embedding', done, total })
      }
    },
    concurrency,
  )

  if (points.length === 0) {
    return { succeeded: 0, failed: total, errors }
  }

  const batchSize = opts.upsertBatchSize ?? 16
  let upserted = 0
  opts.onProgress?.({ phase: 'upserting', done: 0, total: points.length })

  for (let i = 0; i < points.length; i += batchSize) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const chunk = points.slice(i, i + batchSize)
    try {
      await qdrant.upsertPoints(opts.collectionName, chunk)
      upserted += chunk.length
      opts.onProgress?.({ phase: 'upserting', done: upserted, total: points.length })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '写入失败'
      errors.push(`批次 ${i / batchSize + 1}: ${msg}`)
    }
  }

  opts.onProgress?.({ phase: 'done', done: upserted, total: points.length })
  return {
    succeeded: upserted,
    failed: total - upserted,
    errors,
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  concurrency: number,
) {
  let index = 0
  async function worker() {
    while (index < items.length) {
      const i = index++
      await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
}

export function previewPayloadRows(
  files: File[],
  mappings: ScalarMapping[],
  payloadSchema: Record<string, unknown> = {},
  limit = 5,
): { relativePath: string; payload: Record<string, unknown> }[] {
  return files.slice(0, limit).map((file) => {
    const ctx = ingestFileContext(file)
    return {
      relativePath: ctx.relativePath,
      payload: buildPayloadFromMappings(mappings, ctx, undefined, payloadSchema),
    }
  })
}
