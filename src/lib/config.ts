/** 浏览器经 BFF 访问 Qdrant / Embedding，密钥由服务端持有 */
export const QDRANT_API_BASE = '/api/qdrant'
export const EMBED_API_BASE = '/api/embed'

export interface Connection {
  /** 固定为 BFF 代理路径（展示用） */
  url: string
}

const DEFAULT_CONNECTION: Connection = {
  url: QDRANT_API_BASE,
}

export function loadConnection(): Connection {
  return { ...DEFAULT_CONNECTION }
}

export { DEFAULT_CONNECTION }
