import { loadConnection } from './config'

export class QdrantError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'QdrantError'
    this.status = status
  }
}

interface Envelope<T> {
  result: T
  status: string | { error: string }
  time: number
}

type RequestOptions = {
  method?: string
  body?: unknown
  signal?: AbortSignal
  raw?: boolean
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { url, apiKey } = loadConnection()
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (apiKey) headers['api-key'] = apiKey

  let res: Response
  try {
    res = await fetch(`${url}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    })
  } catch {
    throw new QdrantError('无法连接到 Qdrant 服务，请检查服务地址与网络', 0)
  }

  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }

  if (!res.ok) {
    const detail =
      (json as { status?: { error?: string } })?.status?.error ||
      (json as { error?: string })?.error ||
      text ||
      res.statusText
    throw new QdrantError(detail || `请求失败（${res.status}）`, res.status)
  }

  if (opts.raw) return json as T
  return (json as Envelope<T>).result
}

export interface TimedResult<T> {
  data: T
  /** Qdrant 响应 envelope 中的 time 字段（秒 → 毫秒，与官方 Web UI 一致） */
  serverMs: number
}

async function requestTimed<T>(path: string, opts: RequestOptions = {}): Promise<TimedResult<T>> {
  const { url, apiKey } = loadConnection()
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (apiKey) headers['api-key'] = apiKey

  let res: Response
  try {
    res = await fetch(`${url}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    })
  } catch {
    throw new QdrantError('无法连接到 Qdrant 服务，请检查服务地址与网络', 0)
  }

  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }

  if (!res.ok) {
    const detail =
      (json as { status?: { error?: string } })?.status?.error ||
      (json as { error?: string })?.error ||
      text ||
      res.statusText
    throw new QdrantError(detail || `请求失败（${res.status}）`, res.status)
  }

  const envelope = json as Envelope<T>
  return { data: envelope.result, serverMs: Math.round((envelope.time ?? 0) * 1000) }
}

// ---------- 类型 ----------

export type Distance = 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan'
export type CollectionStatus = 'green' | 'yellow' | 'red' | 'grey'

export interface VectorParams {
  size: number
  distance: Distance
  on_disk?: boolean
}

export interface CollectionConfig {
  params: {
    vectors?: VectorParams | Record<string, VectorParams>
    shard_number?: number
    replication_factor?: number
    write_consistency_factor?: number
    on_disk_payload?: boolean
  }
  hnsw_config?: Record<string, unknown>
  optimizer_config?: Record<string, unknown>
  quantization_config?: unknown
}

export interface CollectionInfo {
  status: CollectionStatus
  optimizer_status: 'ok' | { error: string }
  points_count: number
  indexed_vectors_count: number
  segments_count: number
  vectors_count?: number
  config: CollectionConfig
  payload_schema: Record<string, unknown>
}

export interface PointStruct {
  id: string | number
  payload?: Record<string, unknown> | null
  vector?: number[] | Record<string, number[]> | null
}

export interface ScoredPoint extends PointStruct {
  score: number
}

export interface SnapshotDescription {
  name: string
  creation_time: string | null
  size: number
  checksum?: string | null
}

export interface OptimizationSegmentInfo {
  uuid: string
  points_count: number
}

export interface ProgressTree {
  name: string
  started_at?: string | null
  finished_at?: string | null
  duration_sec?: number | null
  done?: number | null
  total?: number | null
  children?: ProgressTree[]
}

export type OptimizationTrackerStatus =
  | 'optimizing'
  | 'done'
  | { cancelled: string }
  | { error: string }

export interface OptimizationTask {
  uuid: string
  optimizer: string
  status: OptimizationTrackerStatus
  segments: OptimizationSegmentInfo[]
  progress: ProgressTree
}

export interface PendingOptimization {
  optimizer: string
  segments: OptimizationSegmentInfo[]
}

export interface OptimizationsSummary {
  queued_optimizations: number
  queued_segments: number
  queued_points: number
  idle_segments: number
}

export interface OptimizationsResponse {
  summary: OptimizationsSummary
  running: OptimizationTask[]
  queued?: PendingOptimization[] | null
  completed?: OptimizationTask[] | null
  idle_segments?: OptimizationSegmentInfo[] | null
}

export interface MemoryUsageBytes {
  disk_bytes: number
  ram_bytes: number
  cached_bytes: number
  expected_cache_bytes: number
}

export interface VectorMemoryBreakdown {
  name: string
  storage: MemoryUsageBytes
  index: MemoryUsageBytes
}

export interface PayloadIndexMemoryBreakdown {
  name: string
  usage: MemoryUsageBytes
}

export interface CollectionMemoryResponse {
  total: MemoryUsageBytes
  vectors: VectorMemoryBreakdown[]
  sparse_vectors: { name: string; storage: MemoryUsageBytes; index: MemoryUsageBytes }[]
  payload: MemoryUsageBytes
  payload_index: PayloadIndexMemoryBreakdown[]
  other?: {
    id_tracker?: MemoryUsageBytes
    [key: string]: MemoryUsageBytes | undefined
  }
}

export interface ProcessMemoryMetrics {
  resident: number | null
  allocated: number | null
}

// ---------- API ----------

export const qdrant = {
  async health(signal?: AbortSignal): Promise<boolean> {
    await request<unknown>('/healthz', { raw: true, signal })
    return true
  },

  listCollections(signal?: AbortSignal) {
    return request<{ collections: { name: string }[] }>('/collections', { signal })
  },

  getCollection(name: string, signal?: AbortSignal) {
    return request<CollectionInfo>(`/collections/${encodeURIComponent(name)}`, { signal })
  },

  getOptimizations(name: string, signal?: AbortSignal) {
    return request<OptimizationsResponse>(
      `/collections/${encodeURIComponent(name)}/optimizations?with=queued,completed,idle_segments&completed_limit=8`,
      { signal },
    )
  },

  getCollectionMemory(name: string, signal?: AbortSignal) {
    return request<CollectionMemoryResponse>(
      `/collections/${encodeURIComponent(name)}/memory`,
      { signal },
    )
  },

  async getProcessMemoryMetrics(signal?: AbortSignal): Promise<ProcessMemoryMetrics> {
    const { url, apiKey } = loadConnection()
    const headers: Record<string, string> = {}
    if (apiKey) headers['api-key'] = apiKey
    const res = await fetch(`${url}/metrics`, { signal, headers })
    const text = await res.text()
    const pick = (name: string) => {
      const m = text.match(new RegExp(`^${name}\\s+(\\d+(?:\\.\\d+)?)`, 'm'))
      return m ? Number(m[1]) : null
    }
    return {
      resident: pick('memory_resident_bytes'),
      allocated: pick('memory_allocated_bytes'),
    }
  },

  getCluster(name: string, signal?: AbortSignal) {
    return request<{
      peer_id: number
      shard_count: number
      local_shards: { shard_id: number; points_count: number; state: string }[]
    }>(`/collections/${encodeURIComponent(name)}/cluster`, { signal })
  },

  createCollection(name: string, body: Record<string, unknown>) {
    return request<boolean>(`/collections/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body,
    })
  },

  updateCollection(name: string, body: Record<string, unknown>) {
    return request<boolean>(`/collections/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body,
    })
  },

  /** 唤醒 grey 状态下暂停的优化器（空 optimizers_config 更新） */
  triggerOptimizers(name: string) {
    return this.updateCollection(name, { optimizers_config: {} })
  },

  deleteCollection(name: string) {
    return request<boolean>(`/collections/${encodeURIComponent(name)}`, { method: 'DELETE' })
  },

  scrollPoints(
    name: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    return request<{ points: PointStruct[]; next_page_offset: string | number | null }>(
      `/collections/${encodeURIComponent(name)}/points/scroll`,
      { method: 'POST', body, signal },
    )
  },

  countPoints(name: string, body: Record<string, unknown>, signal?: AbortSignal) {
    return request<{ count: number }>(
      `/collections/${encodeURIComponent(name)}/points/count`,
      { method: 'POST', body, signal },
    )
  },

  queryPoints(name: string, body: Record<string, unknown>, signal?: AbortSignal) {
    return request<{ points: ScoredPoint[] }>(
      `/collections/${encodeURIComponent(name)}/points/query`,
      { method: 'POST', body, signal },
    )
  },

  queryPointsTimed(name: string, body: Record<string, unknown>, signal?: AbortSignal) {
    return requestTimed<{ points: ScoredPoint[] }>(
      `/collections/${encodeURIComponent(name)}/points/query`,
      { method: 'POST', body, signal },
    )
  },

  getPoint(name: string, id: string | number, signal?: AbortSignal) {
    return request<PointStruct>(
      `/collections/${encodeURIComponent(name)}/points/${encodeURIComponent(String(id))}`,
      { signal },
    )
  },

  deletePoints(name: string, ids: (string | number)[]) {
    return request<boolean>(`/collections/${encodeURIComponent(name)}/points/delete`, {
      method: 'POST',
      body: { points: ids },
    })
  },

  /** 按 filter 批量删除点（无 filter 时删除集合内全部点） */
  deletePointsByFilter(name: string, filter: Record<string, unknown> | null | undefined) {
    return request<boolean>(`/collections/${encodeURIComponent(name)}/points/delete`, {
      method: 'POST',
      body: { filter: filter ?? {} },
    })
  },

  upsertPoints(name: string, points: PointStruct[]) {
    return request<boolean>(`/collections/${encodeURIComponent(name)}/points`, {
      method: 'PUT',
      body: { points },
    })
  },

  /** 整点替换 payload，不要求 vector */
  overwritePayload(name: string, payload: Record<string, unknown>, points: (string | number)[]) {
    return request<boolean>(`/collections/${encodeURIComponent(name)}/points/payload`, {
      method: 'PUT',
      body: { payload, points },
    })
  },

  /** 合并写入 payload 字段（可传 filter 批量更新） */
  setPayload(
    name: string,
    payload: Record<string, unknown>,
    target: { filter?: Record<string, unknown> | null; points?: (string | number)[] },
  ) {
    const body: Record<string, unknown> = { payload }
    if (target.filter) body.filter = target.filter
    if (target.points?.length) body.points = target.points
    return request<boolean>(`/collections/${encodeURIComponent(name)}/points/payload`, {
      method: 'POST',
      body,
    })
  },

  /** 删除指定 payload 键（可传 filter 批量删除） */
  deletePayloadKeys(
    name: string,
    keys: string[],
    target: { filter?: Record<string, unknown> | null; points?: (string | number)[] },
  ) {
    const body: Record<string, unknown> = { keys }
    if (target.filter) body.filter = target.filter
    if (target.points?.length) body.points = target.points
    return request<boolean>(`/collections/${encodeURIComponent(name)}/points/payload/delete`, {
      method: 'POST',
      body,
    })
  },

  countPointsByFilter(name: string, filter: Record<string, unknown> | null | undefined, signal?: AbortSignal) {
    return this.countPoints(name, filter ? { filter, exact: true } : { exact: true }, signal)
  },

  /** keyword 字段 distinct 值（过滤自动补全） */
  facet(name: string, key: string, limit = 50, signal?: AbortSignal) {
    return request<{ hits: { value: unknown; count: number }[] }>(
      `/collections/${encodeURIComponent(name)}/facet`,
      { method: 'POST', body: { key, limit }, signal },
    )
  },

  createPayloadIndex(name: string, fieldName: string, fieldSchema: string) {
    return request<boolean>(`/collections/${encodeURIComponent(name)}/index`, {
      method: 'PUT',
      body: { field_name: fieldName, field_schema: fieldSchema },
    })
  },

  deletePayloadIndex(name: string, fieldName: string) {
    return request<boolean>(
      `/collections/${encodeURIComponent(name)}/index/${encodeURIComponent(fieldName)}`,
      { method: 'DELETE' },
    )
  },

  async samplePayloadKeys(name: string, signal?: AbortSignal): Promise<string[]> {
    const res = await this.scrollPoints(
      name,
      { limit: 50, with_payload: true, with_vector: false },
      signal,
    )
    const keys = new Set<string>()
    for (const p of res.points) {
      if (p.payload) for (const k of Object.keys(p.payload)) keys.add(k)
    }
    return [...keys].sort((a, b) => a.localeCompare(b))
  },

  listSnapshots(name: string, signal?: AbortSignal) {
    return request<SnapshotDescription[]>(
      `/collections/${encodeURIComponent(name)}/snapshots`,
      { signal },
    )
  },

  createSnapshot(name: string) {
    return request<SnapshotDescription>(
      `/collections/${encodeURIComponent(name)}/snapshots`,
      { method: 'POST' },
    )
  },

  deleteSnapshot(name: string, snapshot: string) {
    return request<boolean>(
      `/collections/${encodeURIComponent(name)}/snapshots/${encodeURIComponent(snapshot)}`,
      { method: 'DELETE' },
    )
  },

  snapshotDownloadUrl(name: string, snapshot: string): string {
    const { url } = loadConnection()
    return `${url}/collections/${encodeURIComponent(name)}/snapshots/${encodeURIComponent(snapshot)}`
  },

  async uploadSnapshot(name: string, file: File): Promise<boolean> {
    const { url, apiKey } = loadConnection()
    const form = new FormData()
    form.append('snapshot', file)
    const headers: Record<string, string> = {}
    if (apiKey) headers['api-key'] = apiKey
    const res = await fetch(
      `${url}/collections/${encodeURIComponent(name)}/snapshots/upload?priority=snapshot`,
      { method: 'POST', headers, body: form },
    )
    const text = await res.text()
    if (!res.ok) {
      let msg = text || res.statusText
      try {
        msg = (JSON.parse(text) as { status?: { error?: string } })?.status?.error || msg
      } catch {
        /* keep raw */
      }
      throw new QdrantError(msg, res.status)
    }
    return true
  },

  telemetry(detailsLevel = 3, signal?: AbortSignal) {
    return request<TelemetryResult>(`/telemetry?details_level=${detailsLevel}`, { signal })
  },
}

// telemetry 结构随版本变化较大，用宽松类型
export interface TelemetryResult {
  collections?: {
    collections?: TelemetryCollection[]
  }
  [key: string]: unknown
}

export interface TelemetryCollection {
  id?: string
  shards?: TelemetryShard[]
  [key: string]: unknown
}

export interface TelemetryShard {
  id?: number
  local?: TelemetryShardLocal | null
  [key: string]: unknown
}

/** 分片本地遥测：新版 Qdrant 在此聚合体积与计数 */
export interface TelemetryShardLocal {
  variant_name?: string
  status?: string
  total_optimized_points?: number
  vectors_size_bytes?: number
  payloads_size_bytes?: number
  num_points?: number
  num_vectors?: number
  num_vectors_by_name?: Record<string, number>
  [key: string]: unknown
}

/** 将集合向量配置规范化为 name → VectorParams（默认向量 name 为 ''） */
export function normalizeVectorConfig(
  config: CollectionConfig | undefined,
): Record<string, VectorParams> {
  const vectors = config?.params?.vectors
  if (!vectors) return {}
  if ('size' in vectors && typeof (vectors as VectorParams).size === 'number') {
    return { '': vectors as VectorParams }
  }
  return vectors as Record<string, VectorParams>
}

export interface DenseVectorEntry {
  name: string
  size: number
  distance: Distance
  displayName: string
}

/** 列出集合内所有稠密向量（用于检索评测等） */
export function listDenseVectors(config: CollectionConfig | undefined): DenseVectorEntry[] {
  return Object.entries(normalizeVectorConfig(config)).map(([name, params]) => ({
    name,
    size: params.size,
    distance: params.distance,
    displayName: name === '' ? '默认向量' : name,
  }))
}

/** 从向量参数里提取展示用的 size / distance（兼容单一与命名向量） */
export function primaryVectorParams(
  config: CollectionConfig | undefined,
): { size: number | null; distance: Distance | null; named: string[] } {
  const vectors = config?.params?.vectors
  if (!vectors) return { size: null, distance: null, named: [] }
  if ('size' in vectors && typeof (vectors as VectorParams).size === 'number') {
    const v = vectors as VectorParams
    return { size: v.size, distance: v.distance ?? null, named: [] }
  }
  const named = Object.keys(vectors)
  if (named.length) {
    const first = (vectors as Record<string, VectorParams>)[named[0]]
    return { size: first?.size ?? null, distance: first?.distance ?? null, named }
  }
  return { size: null, distance: null, named: [] }
}
