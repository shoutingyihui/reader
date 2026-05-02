const DEFAULT_TTL_MS = Number.parseInt(process.env.CACHE_TTL_MS || '', 10) || 1000 * 60 * 30
const MAX_ENTRIES = Number.parseInt(process.env.CACHE_MAX_ENTRIES || '', 10) || 100

const cache = new Map()

const getCache = (key) => {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.value
}

const setCache = (key, value, ttl = DEFAULT_TTL_MS) => {
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }
  cache.set(key, { value, expiresAt: Date.now() + ttl })
}

const clearCache = () => cache.clear()

module.exports = {
  DEFAULT_TTL_MS,
  MAX_ENTRIES,
  getCache,
  setCache,
  clearCache,
}
