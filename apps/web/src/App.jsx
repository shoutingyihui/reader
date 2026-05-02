import { useEffect, useMemo, useState } from 'react'
import './App.css'

const DEFAULT_PREFS = {
  theme: 'light',
  fontSize: 18,
  lineHeight: 1.8,
  width: 720,
}

const STORAGE_KEYS = {
  prefs: 'reader:prefs',
  lastArticle: 'reader:lastArticle',
  progress: 'reader:progress',
}

const safeParse = (value, fallback) => {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const loadPrefs = () => {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  const stored = safeParse(window.localStorage.getItem(STORAGE_KEYS.prefs), {})
  return { ...DEFAULT_PREFS, ...stored }
}

const loadLastArticle = () => {
  if (typeof window === 'undefined') return null
  return safeParse(window.localStorage.getItem(STORAGE_KEYS.lastArticle), null)
}

const loadProgressMap = () => {
  if (typeof window === 'undefined') return {}
  return safeParse(window.localStorage.getItem(STORAGE_KEYS.progress), {})
}

const saveProgress = (url, value) => {
  if (!url || typeof window === 'undefined') return
  const map = loadProgressMap()
  map[url] = value
  window.localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(map))
}

const getProgress = (url) => {
  if (!url || typeof window === 'undefined') return 0
  const map = loadProgressMap()
  return map[url] || 0
}

function App() {
  const [prefs, setPrefs] = useState(loadPrefs)
  const [article, setArticle] = useState(() => loadLastArticle())
  const [urlInput, setUrlInput] = useState(() => loadLastArticle()?.sourceUrl || '')
  const [progress, setProgress] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState({ loading: false, error: '' })

  const apiBase = import.meta.env.VITE_API_BASE || ''
  const extractEndpoint = apiBase ? `${apiBase.replace(/\/$/, '')}/api/extract` : '/api/extract'

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme
    window.localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs))
  }, [prefs])

  useEffect(() => {
    if (!article) return
    window.localStorage.setItem(STORAGE_KEYS.lastArticle, JSON.stringify(article))
  }, [article])

  const enhanced = useMemo(() => {
    if (!article || typeof window === 'undefined') {
      return { article, toc: [] }
    }
    const parser = new DOMParser()
    const doc = parser.parseFromString(article.contentHtml || '', 'text/html')
    const headingNodes = doc.querySelectorAll('h1, h2, h3')
    const items = []
    headingNodes.forEach((node, index) => {
      if (!node.id) node.id = `section-${index}`
      items.push({
        id: node.id,
        text: node.textContent || `段落 ${index + 1}`,
        level: node.tagName,
      })
    })
    return {
      article: {
        ...article,
        contentHtml: doc.body.innerHTML,
      },
      toc: items,
    }
  }, [article])

  useEffect(() => {
    if (!article) return
    const restore = () => {
      const saved = getProgress(article.sourceUrl)
      if (saved > 0) window.scrollTo({ top: saved })
    }
    const id = window.requestAnimationFrame(restore)
    return () => window.cancelAnimationFrame(id)
  }, [article])

  useEffect(() => {
    if (!article) return undefined
    const handler = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight
      const ratio = total > 0 ? window.scrollY / total : 0
      setProgress(ratio)
      saveProgress(article.sourceUrl, window.scrollY)
    }
    window.addEventListener('scroll', handler, { passive: true })
    handler()
    return () => window.removeEventListener('scroll', handler)
  }, [article])

  const handleExtract = async () => {
    const trimmed = urlInput.trim()
    if (!trimmed) {
      setStatus({ loading: false, error: '请输入公众号文章链接' })
      return
    }

    setStatus({ loading: true, error: '' })
    try {
      const response = await fetch(extractEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || '解析失败')
      }

      const data = await response.json()
      setArticle(data)
      setStatus({ loading: false, error: '' })
      window.scrollTo({ top: 0 })
    } catch (error) {
      setStatus({ loading: false, error: error.message || '解析失败' })
    }
  }

  const handleClear = () => {
    setArticle(null)
    setProgress(0)
    setStatus({ loading: false, error: '' })
    window.localStorage.removeItem(STORAGE_KEYS.lastArticle)
  }

  const handleFind = () => {
    if (!search.trim()) return
    window.find(search.trim())
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="progress-track">
          <div className="progress" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="topbar-inner">
          <div>
            <h1>微信文章阅读器</h1>
            <p>专注阅读体验：去噪排版、进度记忆、目录导航</p>
          </div>
          <div className="actions">
            <div className="theme">
              <label>主题</label>
              <div className="segmented">
                {['light', 'sepia', 'dark'].map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    className={prefs.theme === theme ? 'active' : ''}
                    onClick={() => setPrefs((prev) => ({ ...prev, theme }))}
                  >
                    {theme === 'light' ? '明亮' : theme === 'sepia' ? '护眼' : '夜间'}
                  </button>
                ))}
              </div>
            </div>
            <div className="adjust">
              <label htmlFor="font">字号</label>
              <input
                id="font"
                type="range"
                min="16"
                max="24"
                value={prefs.fontSize}
                onChange={(event) =>
                  setPrefs((prev) => ({ ...prev, fontSize: Number(event.target.value) }))
                }
              />
            </div>
            <div className="adjust">
              <label htmlFor="line">行距</label>
              <input
                id="line"
                type="range"
                min="1.5"
                max="2.4"
                step="0.1"
                value={prefs.lineHeight}
                onChange={(event) =>
                  setPrefs((prev) => ({ ...prev, lineHeight: Number(event.target.value) }))
                }
              />
            </div>
          </div>
        </div>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <div className="panel">
            <h2>导入文章</h2>
            <div className="input-row">
              <input
                type="url"
                placeholder="粘贴公众号文章链接"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleExtract()}
                aria-label="文章链接"
              />
              <button type="button" onClick={handleExtract} disabled={status.loading}>
                {status.loading ? '解析中…' : '开始阅读'}
              </button>
            </div>
            {status.error && <p className="error">{status.error}</p>}
            {article && (
              <button type="button" className="ghost" onClick={handleClear}>
                清除当前文章
              </button>
            )}
          </div>

          <div className="panel">
            <h2>目录</h2>
            {enhanced.toc.length === 0 ? (
              <p className="muted">文章解析后自动生成目录</p>
            ) : (
              <ul className="toc">
                {enhanced.toc.map((item) => (
                  <li key={item.id} className={item.level.toLowerCase()}>
                    <a href={`#${item.id}`}>{item.text}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <h2>全文搜索</h2>
            <div className="input-row">
              <input
                type="text"
                placeholder="在页面中查找"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button type="button" onClick={handleFind}>
                查找
              </button>
            </div>
            <p className="muted">使用浏览器查找功能逐条定位匹配内容。</p>
          </div>
        </aside>

        <section className="content">
          {!article && (
            <div className="empty">
              <h2>把公众号文章链接粘贴到左侧</h2>
              <p>系统会自动提取正文并优化排版，让阅读更舒适。</p>
            </div>
          )}

          {enhanced.article && (
            <article
              className="reader"
              style={{
                fontSize: `${prefs.fontSize}px`,
                lineHeight: prefs.lineHeight,
                maxWidth: `${prefs.width}px`,
              }}
            >
              <header className="reader-header">
                <h2>{enhanced.article.title}</h2>
                <div className="meta">
                  <span>{enhanced.article.author}</span>
                  <span>{enhanced.article.publishTime}</span>
                  <span>约 {enhanced.article.readingTimeMinutes} 分钟阅读</span>
                  {enhanced.article.cached && <span className="tag">缓存</span>}
                </div>
              </header>
              <div
                className="reader-body"
                dangerouslySetInnerHTML={{ __html: enhanced.article.contentHtml }}
              />
            </article>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
