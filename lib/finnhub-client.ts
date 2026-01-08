import { createHash } from 'crypto'

type FinnhubFetchOptions = {
  cacheSeconds?: number
  method?: string
  body?: any
  headers?: Record<string, string>
  signal?: AbortSignal
}

const FINNHUB_KEYS = [process.env.FINNHUB_API_KEY, process.env.FINNHUB_API_KEY_SECONDARY].filter(Boolean) as string[]
let finnhubIndex = 0

function getNextKey() {
  if (FINNHUB_KEYS.length === 0) return null
  const key = FINNHUB_KEYS[finnhubIndex % FINNHUB_KEYS.length]
  finnhubIndex += 1
  return key
}

function shouldRetry(status?: number) {
  return status === 429 || (status !== undefined && status >= 500)
}

function buildUrl(path: string, params: Record<string, string | number | undefined>, key: string) {
  const url = new URL(`https://finnhub.io/api/v1/${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  })
  url.searchParams.set('token', key)
  return url.toString()
}

export async function finnhubFetch<T = any>(
  path: string,
  params: Record<string, string | number | undefined>,
  options: FinnhubFetchOptions = {},
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const { cacheSeconds = 0, method = 'GET', body, headers, signal } = options
  if (FINNHUB_KEYS.length === 0) {
    return { ok: false, status: 401, data: null }
  }

  const keysTried = new Set<string>()
  let lastStatus = 500

  for (let attempt = 0; attempt < FINNHUB_KEYS.length; attempt += 1) {
    const key = getNextKey()
    if (!key || keysTried.has(key)) continue
    keysTried.add(key)

    const url = buildUrl(path, params, key)
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
      next: cacheSeconds ? { revalidate: cacheSeconds } : undefined,
    })

    lastStatus = res.status
    if (!res.ok && shouldRetry(res.status)) {
      continue
    }

    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  }

  return { ok: false, status: lastStatus, data: null }
}

export function buildCacheKey(prefix: string, input: any) {
  const hash = createHash('sha1').update(JSON.stringify(input)).digest('hex')
  return `${prefix}:${hash}`
}
