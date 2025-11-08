type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const cacheStore = new Map<string, CacheEntry<any>>()

export function getFromCache<T>(key: string): { value: T; isStale: boolean } | null {
  const entry = cacheStore.get(key)
  if (!entry) return null

  const now = Date.now()
  if (now < entry.expiresAt) {
    return { value: entry.value as T, isStale: false }
  }

  // entry expired but keep value for potential stale usage
  return { value: entry.value as T, isStale: true }
}

export function setCache<T>(key: string, value: T, ttlMs: number) {
  const expiresAt = Date.now() + ttlMs
  cacheStore.set(key, { value, expiresAt })
}

export function deleteCache(key: string) {
  cacheStore.delete(key)
}


