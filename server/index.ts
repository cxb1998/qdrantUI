import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { cors } from 'hono/cors'
import { IS_PROD, PORT } from './config'
import { permissionsForRole } from './rbac'
import { proxyEmbed, proxyQdrant } from './proxy'
import { clearSessionCookie, getSessionUser, setSessionCookie } from './session'
import { verifyUser } from './users'

const app = new Hono()

app.use(
  '/api/*',
  cors({
    origin: (origin) => origin || '*',
    credentials: true,
  }),
)

app.get('/api/auth/me', (c) => {
  const user = getSessionUser(c)
  if (!user) return c.json({ error: '未登录' }, 401)
  return c.json({
    user: user.username,
    role: user.role,
    ...permissionsForRole(user.role),
  })
})

app.post('/api/auth/login', async (c) => {
  let body: { username?: string; password?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: '请求格式错误' }, 400)
  }
  const username = body.username?.trim()
  const password = body.password ?? ''
  if (!username || !password) return c.json({ error: '请输入用户名和密码' }, 400)

  try {
    const user = await verifyUser(username, password)
    if (!user) return c.json({ error: '用户名或密码错误' }, 401)
    setSessionCookie(c, user)
    return c.json({ user: user.username, role: user.role, ...permissionsForRole(user.role) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '登录失败'
    return c.json({ error: msg }, 500)
  }
})

app.post('/api/auth/logout', (c) => {
  clearSessionCookie(c)
  return c.json({ ok: true })
})

app.all('/api/qdrant/*', async (c) => {
  const user = getSessionUser(c)
  if (!user) return c.json({ error: '未登录' }, 401)
  return proxyQdrant(c, user)
})

app.all('/api/embed/*', async (c) => {
  const user = getSessionUser(c)
  if (!user) return c.json({ error: '未登录' }, 401)
  return proxyEmbed(c, user)
})

if (IS_PROD) {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`BFF 运行于 http://localhost:${info.port}`)
  if (!IS_PROD) {
    console.log('开发模式：请同时运行 npm run dev，并通过 Vite 代理访问 /api')
  }
})
