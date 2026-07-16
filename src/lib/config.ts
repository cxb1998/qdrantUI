const STORAGE_KEY = 'qdrant-console.connection'

export interface EmbedSettings {
  /** 向量服务地址，例如 http://localhost:8765 */
  url: string
  apiKey: string
  /** 开发用：不请求真实服务，在浏览器内生成伪向量 */
  useMock: boolean
}

export interface Connection {
  /** Qdrant REST 服务地址，例如 http://localhost:6333 */
  url: string
  /** 可选 API Key，通过 api-key 请求头发送 */
  apiKey: string
  embed: EmbedSettings
}

const DEFAULT_EMBED: EmbedSettings = {
  url: 'http://localhost:8765',
  apiKey: '',
  useMock: true,
}

const DEFAULT_CONNECTION: Connection = {
  url: 'http://localhost:6333',
  apiKey: '',
  embed: { ...DEFAULT_EMBED },
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function loadConnection(): Connection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CONNECTION, embed: { ...DEFAULT_EMBED } }
    const parsed = JSON.parse(raw) as Partial<Connection> & { embed?: Partial<EmbedSettings> }
    return {
      url: normalizeUrl(parsed.url || DEFAULT_CONNECTION.url),
      apiKey: parsed.apiKey ?? '',
      embed: {
        url: normalizeUrl(parsed.embed?.url || DEFAULT_EMBED.url),
        apiKey: parsed.embed?.apiKey ?? '',
        useMock: parsed.embed?.useMock ?? DEFAULT_EMBED.useMock,
      },
    }
  } catch {
    return { ...DEFAULT_CONNECTION, embed: { ...DEFAULT_EMBED } }
  }
}

export function loadEmbedSettings(): EmbedSettings {
  return loadConnection().embed
}

export function saveConnection(conn: Connection): Connection {
  const next: Connection = {
    url: normalizeUrl(conn.url) || DEFAULT_CONNECTION.url,
    apiKey: conn.apiKey.trim(),
    embed: {
      url: normalizeUrl(conn.embed.url) || DEFAULT_EMBED.url,
      apiKey: conn.embed.apiKey.trim(),
      useMock: conn.embed.useMock,
    },
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('qdrant-connection-changed'))
  return next
}

export { DEFAULT_CONNECTION, DEFAULT_EMBED }
