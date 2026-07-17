#!/usr/bin/env node
import { hash } from 'bcryptjs'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const usersFile = resolve(__dirname, '../server/users.json')

const username = process.argv[2]?.trim()
const password = process.argv[3]

if (!username || !password) {
  console.error('用法: npm run set-password -- <用户名> <新密码>')
  console.error('示例: npm run set-password -- admin MyStr0ngPass')
  process.exit(1)
}

if (!existsSync(usersFile)) {
  console.error(`用户文件不存在：${usersFile}`)
  console.error('请先运行 npm run init:users')
  process.exit(1)
}

const users = JSON.parse(readFileSync(usersFile, 'utf8'))
if (!Array.isArray(users)) {
  console.error('users.json 格式错误：应为数组')
  process.exit(1)
}

const idx = users.findIndex((u) => u.username === username)
if (idx < 0) {
  console.error(`未找到用户：${username}`)
  console.error('当前用户：', users.map((u) => u.username).join(', ') || '（无）')
  process.exit(1)
}

users[idx].passwordHash = await hash(password, 10)
writeFileSync(usersFile, `${JSON.stringify(users, null, 2)}\n`, { mode: 0o600 })
console.log(`已更新用户 ${username} 的密码`)
console.log('无需重启 BFF，下次登录即生效')
