#!/usr/bin/env node
import { hash } from 'bcryptjs'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = process.env.USERS_FILE?.trim() || resolve(__dirname, '../server/users.json')

const defaults = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'viewer', password: 'viewer123', role: 'viewer' },
]

async function main() {
  if (existsSync(out)) {
    console.error(`已存在 ${out}，若需重置请先删除该文件`)
    process.exit(1)
  }
  const users = []
  for (const u of defaults) {
    users.push({
      username: u.username,
      passwordHash: await hash(u.password, 10),
      role: u.role,
    })
  }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `${JSON.stringify(users, null, 2)}\n`, { mode: 0o600 })
  console.log(`已生成 ${out}`)
  console.log('默认账号：')
  for (const u of defaults) {
    console.log(`  ${u.username} / ${u.password} (${u.role})`)
  }
  console.log('生产环境请尽快修改密码：npm run set-password -- admin <新密码>')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
