import { compare } from 'bcryptjs'
import { loadUsersFile } from './config'
import type { SessionUser } from './session'

export async function verifyUser(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const users = loadUsersFile()
  const user = users.find((u) => u.username === username.trim())
  if (!user) return null
  const ok = await compare(password, user.passwordHash)
  if (!ok) return null
  return { username: user.username, role: user.role }
}
