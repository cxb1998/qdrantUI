import type { Context } from 'hono'
import {
  EMBED_API_KEY,
  EMBED_URL,
  QDRANT_URL,
} from './config'
import { canAccessQdrantRequest, pickQdrantApiKey } from './rbac'
import type { SessionUser } from './session'

const FORBIDDEN_MSG = '当前账号为只读，无法执行此操作'

function isQdrantWrite(method: string, path: string): boolean {
  return !canAccessQdrantRequest(method, path, 'viewer')
}

async function proxyRequest(
  c: Context,
  targetBase: string,
  stripPrefix: string,
  apiKey: string,
) {
  const incoming = new URL(c.req.url)
  const path = incoming.pathname.replace(stripPrefix, '') || '/'
  const target = `${targetBase}${path}${incoming.search}`

  const headers = new Headers()
  const contentType = c.req.header('content-type')
  if (contentType) headers.set('content-type', contentType)
  if (apiKey) headers.set('api-key', apiKey)

  const method = c.req.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const body = hasBody ? await c.req.arrayBuffer() : undefined

  const res = await fetch(target, { method, headers, body })
  const outHeaders = new Headers()
  const resType = res.headers.get('content-type')
  if (resType) outHeaders.set('content-type', resType)

  return new Response(res.body, { status: res.status, headers: outHeaders })
}

export async function proxyQdrant(c: Context, user: SessionUser) {
  const incoming = new URL(c.req.url)
  const path = incoming.pathname.replace(/^\/api\/qdrant/, '') || '/'
  const method = c.req.method

  if (!canAccessQdrantRequest(method, path, user.role)) {
    return c.json({ error: FORBIDDEN_MSG }, 403)
  }

  const write = isQdrantWrite(method, path)
  const apiKey = pickQdrantApiKey(user.role, write)
  return proxyRequest(c, QDRANT_URL, /^\/api\/qdrant/, apiKey)
}

export async function proxyEmbed(c: Context, _user: SessionUser) {
  const apiKey = EMBED_API_KEY
  return proxyRequest(c, EMBED_URL, /^\/api\/embed/, apiKey)
}
