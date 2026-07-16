/**
 * 可选本地 Mock：模拟 DINOv3 向量服务
 * 用法：npm run mock:embed
 * 默认 http://localhost:8765/embed/image
 */
import http from 'node:http'
import { randomBytes } from 'node:crypto'

const PORT = Number(process.env.MOCK_EMBED_PORT || 8765)
const DEFAULT_DIM = 512

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, api-key')
}

function l2Normalize(v) {
  let sum = 0
  for (const x of v) sum += x * x
  const norm = Math.sqrt(sum) || 1
  return v.map((x) => x / norm)
}

function randomVector(dim) {
  const buf = randomBytes(dim * 4)
  const v = []
  for (let i = 0; i < dim; i++) {
    const n = buf.readUInt32BE(i % (buf.length - 3)) / 0xffffffff
    v.push(n * 2 - 1)
  }
  return l2Normalize(v)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  cors(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', model: 'mock-dinov3' }))
    return
  }

  if (req.method === 'POST' && req.url?.startsWith('/embed/image')) {
    await readBody(req)
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
    const dim = Math.min(4096, Math.max(1, Number(url.searchParams.get('dim')) || DEFAULT_DIM))
    const vector = randomVector(dim)
    const patch_num = Math.floor(Math.random() * 11)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        vector,
        dimension: dim,
        model: 'mock-dinov3',
        payload: { patch_num },
      }),
    )
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found' }))
})

server.listen(PORT, () => {
  console.log(`Mock embed 服务: http://localhost:${PORT}`)
  console.log(`  POST /embed/image  → { vector, dimension, model, payload }`)
  console.log(`  GET  /health`)
})
