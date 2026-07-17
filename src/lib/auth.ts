export type UserRole = 'viewer' | 'admin'

export interface AuthUser {
  user: string
  role: UserRole
  canRead: boolean
  canWrite: boolean
  canAdmin: boolean
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return (text ? JSON.parse(text) : {}) as T
  } catch {
    throw new AuthError(text || res.statusText, res.status)
  }
}

export async function fetchMe(signal?: AbortSignal): Promise<AuthUser> {
  const res = await fetch('/api/auth/me', { credentials: 'include', signal })
  if (res.status === 401) throw new AuthError('未登录', 401)
  const body = await parseJson<{ error?: string } & Partial<AuthUser>>(res)
  if (!res.ok) throw new AuthError(body.error || `请求失败（${res.status}）`, res.status)
  if (!body.user || !body.role) throw new AuthError('会话无效', 401)
  return {
    user: body.user,
    role: body.role,
    canRead: body.canRead ?? true,
    canWrite: body.canWrite ?? body.role === 'admin',
    canAdmin: body.canAdmin ?? body.role === 'admin',
  }
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await parseJson<{ error?: string } & Partial<AuthUser>>(res)
  if (!res.ok) throw new AuthError(body.error || '登录失败', res.status)
  if (!body.user || !body.role) throw new AuthError('登录响应无效', 502)
  return {
    user: body.user,
    role: body.role,
    canRead: body.canRead ?? true,
    canWrite: body.canWrite ?? body.role === 'admin',
    canAdmin: body.canAdmin ?? body.role === 'admin',
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}

export const AUTH_REQUIRED_EVENT = 'qdrant-auth-required'

export function notifyAuthRequired() {
  window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT))
}
