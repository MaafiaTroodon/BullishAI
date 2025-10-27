interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>
  private maxSize: number
  private defaultTTL: number

  constructor(maxSize: number = 100, defaultTTL: number = 15 * 1000) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    // Move to end (LRU)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.data
  }

  set(key: string, data: T, ttl?: number): void {
    // Remove if exists
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Check if at max size
    if (this.cache.size >= this.maxSize) {
      // Remove oldest
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    })
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

// Global instances
export const quoteCache = new LRUCache<any>(50, 15000) // 15s TTL
export const newsCache = new LRUCache<any[]>(50, 30000) // 30s TTL
export const fundamentalsCache = new LRUCache<any>(50, 60000) // 60s TTL

