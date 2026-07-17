export type Role = 'viewer' | 'admin'

export interface Permissions {
  canRead: boolean
  canWrite: boolean
  canAdmin: boolean
}

export function permissionsForRole(role: Role): Permissions {
  return {
    canRead: true,
    canWrite: role === 'admin',
    canAdmin: role === 'admin',
  }
}

const READ_POST_SUFFIXES = ['/points/scroll', '/points/count', '/points/query', '/facet']

/** viewer 仅允许读类 Qdrant 请求；admin 全部放行 */
export function canAccessQdrantRequest(method: string, path: string, role: Role): boolean {
  if (role === 'admin') return true
  const upper = method.toUpperCase()
  if (upper === 'GET' || upper === 'HEAD') return true
  if (upper === 'POST' && READ_POST_SUFFIXES.some((s) => path.endsWith(s))) return true
  return false
}

export function pickQdrantApiKey(role: Role, isWrite: boolean): string {
  if (isWrite) return process.env.QDRANT_API_KEY?.trim() || ''
  const readKey = process.env.QDRANT_READ_KEY?.trim()
  if (readKey) return readKey
  return process.env.QDRANT_API_KEY?.trim() || ''
}
