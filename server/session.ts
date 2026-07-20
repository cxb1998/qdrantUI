import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { SESSION_SECRET } from './config'
import type { Role } from './rbac'

const COOKIE_NAME = 'qdrant_session'
const MAX_AGE_SEC = 60 * 60 * 24 * 7

export interface SessionUser {
  username: string
  role: Role
}

function sign(data: string): string {
  return createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
}

export function createSessionToken(user: SessionUser): string {
  const payload = Buffer.from(
    JSON.stringify({ ...user, exp: Date.now() + MAX_AGE_SEC * 1000 }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function parseSessionToken(token: string | undefined): SessionUser | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(payload)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      username?: string
      role?: Role
      exp?: number
    }
    if (!parsed.username || !parsed.role) return null
    if (parsed.exp != null && Date.now() > parsed.exp) return null
    return { username: parsed.username, role: parsed.role }
  } catch {
    return null
  }
}

export function getSessionUser(c: Context): SessionUser | null {
  return parseSessionToken(getCookie(c, COOKIE_NAME))
}

/** 仅 HTTPS 请求设置 Secure Cookie；可用 COOKIE_SECURE=true/false 强制覆盖 */
function cookieSecure(c: Context): boolean {
  if (process.env.COOKIE_SECURE === 'true') return true
  if (process.env.COOKIE_SECURE === 'false') return false
  const forwarded = c.req.header('x-forwarded-proto')
  if (forwarded) return forwarded.split(',')[0]!.trim() === 'https'
  try {
    return new URL(c.req.url).protocol === 'https:'
  } catch {
    return false
  }
}

export function setSessionCookie(c: Context, user: SessionUser) {
  const secure = cookieSecure(c)
  setCookie(c, COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    path: '/',
    maxAge: MAX_AGE_SEC,
  })
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE_NAME, { path: '/', secure: cookieSecure(c) })
}
