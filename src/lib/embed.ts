import { EMBED_API_BASE, loadEmbedSettings } from './config'
import { notifyAuthRequired } from './auth'

export class EmbedError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'EmbedError'
    this.status = status
  }
}

export interface EmbedResult {
  vector: number[]
  dimension: number
  model?: string
  mocked?: boolean
  /** 向量服务返回的标量片段，入库时与映射结果合并（同名字段以此为准） */
  payload?: Record<string, unknown>
}

/** 由图片内容生成确定性伪随机向量（Mock 用，同图同向量） */
export async function mockVectorFromFile(file: File, dimension: number): Promise<number[]> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let seed = 2166136261
  const limit = Math.min(bytes.length, 65536)
  for (let i = 0; i < limit; i++) {
    seed ^= bytes[i]
    seed = Math.imul(seed, 16777619)
  }

  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const raw = Array.from({ length: dimension }, () => next() * 2 - 1)
  let sumSq = 0
  for (const x of raw) sumSq += x * x
  const norm = Math.sqrt(sumSq) || 1
  return raw.map((x) => x / norm)
}

/** Mock：模拟向量服务返回的 payload.patch_num（0–10 随机整数） */
export async function mockEmbedPayloadFromFile(_file: File): Promise<Record<string, unknown>> {
  return { patch_num: Math.floor(Math.random() * 11) }
}

function parseEmbedPayload(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  return raw as Record<string, unknown>
}

function parseEmbedResponse(json: unknown, expectedDim?: number): EmbedResult {
  const body = json as {
    vector?: number[]
    embedding?: number[]
    dimension?: number
    model?: string
    payload?: unknown
  }
  const vector = body.vector ?? body.embedding
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new EmbedError('向量服务响应缺少 vector 字段', 502)
  }
  if (!vector.every((x) => typeof x === 'number' && Number.isFinite(x))) {
    throw new EmbedError('向量服务返回了非法数值', 502)
  }
  const dimension = body.dimension ?? vector.length
  if (expectedDim != null && vector.length !== expectedDim) {
    throw new EmbedError(
      `向量维度 ${vector.length} 与集合维度 ${expectedDim} 不一致`,
      422,
    )
  }
  return { vector, dimension, model: body.model, payload: parseEmbedPayload(body.payload) }
}

/** 上传图片并向量；useMock 时在浏览器内生成伪向量 */
export async function embedImage(
  file: File,
  expectedDim?: number,
  signal?: AbortSignal,
): Promise<EmbedResult> {
  const settings = loadEmbedSettings()

  if (settings.useMock) {
    const dim = expectedDim ?? 512
    const vector = await mockVectorFromFile(file, dim)
    const payload = await mockEmbedPayloadFromFile(file)
    return { vector, dimension: dim, model: 'mock-local', mocked: true, payload }
  }

  const form = new FormData()
  form.append('file', file)

  let res: Response
  try {
    res = await fetch(`${EMBED_API_BASE}/embed/image`, {
      method: 'POST',
      body: form,
      signal,
      credentials: 'include',
    })
  } catch {
    throw new EmbedError('无法连接向量服务，请检查 BFF 与网络', 0)
  }

  if (res.status === 401) notifyAuthRequired()

  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    throw new EmbedError(text || `向量服务错误（${res.status}）`, res.status)
  }

  if (!res.ok) {
    const detail =
      (json as { error?: string; detail?: string; message?: string }).error ||
      (json as { detail?: string }).detail ||
      (json as { message?: string }).message ||
      text ||
      res.statusText
    throw new EmbedError(detail || `向量服务错误（${res.status}）`, res.status)
  }

  const result = parseEmbedResponse(json, expectedDim)
  return { ...result, mocked: false }
}

export async function embedHealth(signal?: AbortSignal): Promise<boolean> {
  const settings = loadEmbedSettings()
  if (settings.useMock) return true

  const base = EMBED_API_BASE
  if (!base) throw new EmbedError('未配置向量服务', 0)

  let res: Response
  try {
    res = await fetch(`${base}/health`, { signal, credentials: 'include' })
  } catch {
    throw new EmbedError('无法连接向量服务', 0)
  }
  if (res.status === 401) notifyAuthRequired()
  if (!res.ok) throw new EmbedError(`探活失败（${res.status}）`, res.status)
  return true
}
