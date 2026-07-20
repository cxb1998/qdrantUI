import { EMBED_API_BASE } from './config'
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
  /** 向量服务返回的标量片段，入库时与映射结果合并（同名字段以此为准） */
  payload?: Record<string, unknown>
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

export async function embedImage(
  file: File,
  expectedDim?: number,
  signal?: AbortSignal,
): Promise<EmbedResult> {
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

  return parseEmbedResponse(json, expectedDim)
}

export async function embedHealth(signal?: AbortSignal): Promise<boolean> {
  let res: Response
  try {
    res = await fetch(`${EMBED_API_BASE}/health`, { signal, credentials: 'include' })
  } catch {
    throw new EmbedError('无法连接向量服务', 0)
  }
  if (res.status === 401) notifyAuthRequired()
  if (!res.ok) throw new EmbedError(`探活失败（${res.status}）`, res.status)
  return true
}
