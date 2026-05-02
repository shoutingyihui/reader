const express = require('express')
const cors = require('cors')
const { extractArticle } = require('./extract')
const { getCache, setCache } = require('./cache')

const DEFAULT_ALLOWED_HOSTS = ['mp.weixin.qq.com']
const DEFAULT_IMAGE_HOSTS = ['mmbiz.qpic.cn', 'mmbiz.qlogo.cn']
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173']

const parseList = (value) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : []

const allowedHosts = parseList(process.env.ALLOWED_HOSTS)
const imageHosts = parseList(process.env.IMAGE_HOSTS)
const allowedOrigins = parseList(process.env.CORS_ORIGINS)

const hostAllowlist = allowedHosts.length ? allowedHosts : DEFAULT_ALLOWED_HOSTS
const imageAllowlist = imageHosts.length ? imageHosts : DEFAULT_IMAGE_HOSTS
const originAllowlist = allowedOrigins.length ? allowedOrigins : DEFAULT_ALLOWED_ORIGINS

const app = express()
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, false)
      return callback(null, originAllowlist.includes(origin))
    },
    methods: ['GET', 'POST'],
  }),
)
app.use(express.json({ limit: '1mb' }))

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  })
  next()
})

const normalizeUrl = (value) => {
  const url = new URL(value)
  url.hash = ''
  return url.toString()
}

const isAllowedHost = (url, allowlist) => {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') return false
  return allowlist.includes(parsed.hostname)
}

const fetchHtml = async (targetUrl) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(targetUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    })

    if (!response.ok) {
      throw new Error(`上游请求失败 (${response.status})`)
    }

    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/extract', async (req, res) => {
  try {
    const { url } = req.body || {}
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: '请提供文章链接' })
    }

    let normalizedUrl
    try {
      normalizedUrl = normalizeUrl(url.trim())
    } catch {
      return res.status(400).json({ error: '链接格式不正确' })
    }

    if (!isAllowedHost(normalizedUrl, hostAllowlist)) {
      return res.status(400).json({
        error: `仅支持以下来源：${hostAllowlist.join(', ')}`,
      })
    }

    const cached = getCache(normalizedUrl)
    if (cached) {
      return res.json({ cached: true, ...cached })
    }

    const html = await fetchHtml(new URL(normalizedUrl))
    const article = extractArticle(html, normalizedUrl, {
      proxyPath: '/api/proxy?url=',
    })
    setCache(normalizedUrl, article)

    return res.json({ cached: false, ...article })
  } catch (error) {
    console.error('extract error', error)
    return res.status(500).json({ error: '解析失败，请稍后重试' })
  }
})

app.get('/api/proxy', async (req, res) => {
  const { url } = req.query
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: '缺少资源地址' })
  }

  let normalized
  try {
    normalized = new URL(url).toString()
  } catch {
    return res.status(400).json({ error: '资源地址无效' })
  }

  if (!isAllowedHost(normalized, imageAllowlist)) {
    return res.status(400).json({ error: '资源域名未被允许' })
  }

  try {
    const response = await fetch(new URL(normalized).toString())
    if (!response.ok) {
      return res.status(response.status).json({ error: '资源获取失败' })
    }

    const contentType = response.headers.get('content-type')
    if (contentType) res.set('Content-Type', contentType)
    res.set('Cache-Control', 'public, max-age=86400')

    const buffer = Buffer.from(await response.arrayBuffer())
    return res.send(buffer)
  } catch (error) {
    console.error('proxy error', error)
    return res.status(500).json({ error: '资源代理失败' })
  }
})

const port = Number.parseInt(process.env.PORT || '', 10) || 8787
app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})
