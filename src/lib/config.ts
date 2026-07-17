const STORAGE_KEY = 'qdrant-console.embed'

/** 浏览器经 BFF 访问 Qdrant，密钥由服务端持有 */
export const QDRANT_API_BASE = '/api/qdrant'
export const EMBED_API_BASE = '/api/embed'

export interface EmbedSettings {
  /** 开发用：不请求真实服务，在浏览器内生成伪向量 */
  useMock: boolean
}

export interface Connection {
  /** 固定为 BFF 代理路径（展示用） */
  url: string
  embed: EmbedSettings
}

const DEFAULT_EMBED: EmbedSettings = {
  useMock: true,
}

const DEFAULT_CONNECTION: Connection = {
  url: QDRANT_API_BASE,
  embed: { ...DEFAULT_EMBED },
}

export function loadConnection(): Connection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CONNECTION, embed: { ...DEFAULT_EMBED } }
    const parsed = JSON.parse(raw) as Partial<EmbedSettings>
    return {
      url: QDRANT_API_BASE,
      embed: {
        useMock: parsed.useMock ?? DEFAULT_EMBED.useMock,
      },
    }
  } catch {
    return { ...DEFAULT_CONNECTION, embed: { ...DEFAULT_EMBED } }
  }
}

export function loadEmbedSettings(): EmbedSettings {
  return loadConnection().embed
}

export function saveEmbedSettings(embed: EmbedSettings): EmbedSettings {
  const next: EmbedSettings = { useMock: embed.useMock }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('qdrant-connection-changed'))
  return next
}

export { DEFAULT_CONNECTION, DEFAULT_EMBED }
