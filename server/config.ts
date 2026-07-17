import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(serverDir, '..')

/** 启动时加载项目根目录 .env（不覆盖已有环境变量） */
function loadEnvFile() {
  const path = resolve(projectRoot, '.env')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvFile()

function env(key: string, fallback = ''): string {
  return process.env[key]?.trim() || fallback
}

export const PORT = Number(env('PORT', '8787'))
export const SESSION_SECRET = env('SESSION_SECRET', 'dev-change-me-in-production')
export const QDRANT_URL = env('QDRANT_URL', 'http://127.0.0.1:6333').replace(/\/+$/, '')
export const QDRANT_API_KEY = env('QDRANT_API_KEY', '')
export const QDRANT_READ_KEY = env('QDRANT_READ_KEY', '')
export const EMBED_URL = env('EMBED_URL', 'http://127.0.0.1:8765').replace(/\/+$/, '')
export const EMBED_API_KEY = env('EMBED_API_KEY', '')
export const USERS_FILE = env('USERS_FILE', resolve(serverDir, 'users.json'))
export const IS_PROD = process.env.NODE_ENV === 'production'

export function loadUsersFile(): { username: string; passwordHash: string; role: 'viewer' | 'admin' }[] {
  const path = USERS_FILE
  if (!existsSync(path)) {
    throw new Error(
      `用户文件不存在：${path}。请运行 npm run init:users 生成，或复制 server/users.example.json`,
    )
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
  if (!Array.isArray(raw)) throw new Error('users.json 格式错误：应为数组')
  return raw as { username: string; passwordHash: string; role: 'viewer' | 'admin' }[]
}
