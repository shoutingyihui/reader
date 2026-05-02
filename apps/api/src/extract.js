const cheerio = require('cheerio')
const sanitizeHtml = require('sanitize-html')

const ALLOWED_TAGS = sanitizeHtml.defaults.allowedTags.concat([
  'article',
  'section',
  'figure',
  'figcaption',
  'img',
  'h1',
  'h2',
  'h3',
  'h4',
  'pre',
  'code',
  'blockquote',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
])

const ALLOWED_ATTRIBUTES = {
  a: ['href', 'name', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  '*': ['id'],
}

const WECHAT_SELECTORS = {
  title: '#activity-name',
  author: '#js_name',
  publishTime: '#publish_time',
  content: '#js_content',
}

const countWords = (text) => {
  const cjkMatches = text.match(/[\u4e00-\u9fff]/g) || []
  const latinWords = text
    .replace(/[\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return cjkMatches.length + latinWords.length
}

const resolveUrl = (value, base) => {
  if (!value) return null
  try {
    return new URL(value, base).toString()
  } catch {
    return null
  }
}

const sanitizeContent = (html) =>
  sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'data'],
    allowProtocolRelative: false,
  })

const rewriteContent = (html, sourceUrl, proxyPath = '') => {
  const $ = cheerio.load(html)

  $('img').each((_, img) => {
    const $img = $(img)
    const rawSrc = $img.attr('src') || $img.attr('data-src')
    const resolved = resolveUrl(rawSrc, sourceUrl)
    if (!resolved) return
    const proxyUrl = proxyPath ? `${proxyPath}${encodeURIComponent(resolved)}` : resolved
    $img.attr('src', proxyUrl)
    $img.removeAttr('data-src')
    $img.attr('loading', 'lazy')
    $img.attr('decoding', 'async')
    $img.attr('referrerpolicy', 'no-referrer')
  })

  $('a').each((_, link) => {
    const $link = $(link)
    const resolved = resolveUrl($link.attr('href'), sourceUrl)
    if (resolved) $link.attr('href', resolved)
    $link.attr('target', '_blank')
    $link.attr('rel', 'noreferrer noopener')
  })

  return $.root().html() || ''
}

const extractArticle = (html, sourceUrl, options = {}) => {
  const { proxyPath = '/api/proxy?url=' } = options
  const $ = cheerio.load(html)

  const title = $(WECHAT_SELECTORS.title).text().trim() || $('title').text().trim()
  const author = $(WECHAT_SELECTORS.author).text().trim() || $('.profile_nickname').text().trim()
  const publishTime = $(WECHAT_SELECTORS.publishTime).text().trim()

  const contentNode = $(WECHAT_SELECTORS.content)
  const rawContent = contentNode.length ? contentNode.html() : $('article').html()

  const sanitized = sanitizeContent(rawContent || '')
  const rewritten = rewriteContent(sanitized, sourceUrl, proxyPath)

  const textContent = cheerio.load(rewritten).text()
  const wordCount = countWords(textContent)
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 350))

  return {
    sourceUrl,
    title: title || '未命名文章',
    author: author || '未知作者',
    publishTime: publishTime || '未知时间',
    contentHtml: rewritten,
    wordCount,
    readingTimeMinutes,
    extractedAt: new Date().toISOString(),
  }
}

module.exports = {
  extractArticle,
}
