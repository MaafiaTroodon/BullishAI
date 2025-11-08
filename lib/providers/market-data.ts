import axios from 'axios'
import { getFromCache, setCache } from '@/lib/providers/cache'

const FINNHUB_KEY = process.env.FINNHUB_API_KEY
const MASSIVE_KEY = process.env.POLYGON_API_KEY
const TWELVE_KEY = process.env.TWELVEDATA_API_KEY || process.env.TWELVE_DATA_API_KEY
const ALPHA_KEY = process.env.ALPHAVANTAGE_API_KEY

export type QuoteSource = 'Finnhub' | 'Massive' | 'TwelveData' | 'AlphaVantage' | 'Cached'

export interface QuoteResult {
  symbol: string
  price: number
  change: number
  changePct: number
  open?: number
  high?: number
  low?: number
  previousClose?: number
  volume?: number
  marketCap?: number
  currency?: string
  source: QuoteSource | string
  fetchedAt: number
  stale?: boolean
}

const QUOTE_CACHE_TTL_MS = 15_000 // 15 seconds active cache
const QUOTE_STALE_TTL_MS = 5 * 60_000 // 5 minutes for stale fallbacks

async function safeGet<T>(url: string, timeout = 4000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await axios.get<T>(url, { timeout, signal: controller.signal })
    clearTimeout(id)
    return res.data
  } finally {
    clearTimeout(id)
  }
}

async function fetchFromFinnhub(symbol: string): Promise<QuoteResult | null> {
  if (!FINNHUB_KEY) return null
  try {
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`

    const [quote, profile] = await Promise.all([
      safeGet<any>(quoteUrl),
      safeGet<any>(profileUrl).catch(() => null),
    ])

    if (!quote || !quote.c) return null

    const price = Number(quote.c)
    const prevClose = Number(quote.pc || price)
    const change = price - prevClose
    const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0

    return {
      symbol,
      price,
      change,
      changePct,
      open: Number(quote.o) || undefined,
      high: Number(quote.h) || undefined,
      low: Number(quote.l) || undefined,
      previousClose: prevClose,
      volume: Number(quote.v) || undefined,
      marketCap: profile?.marketCapitalization ? Number(profile.marketCapitalization) * 1_000_000 : undefined,
      currency: profile?.currency || 'USD',
      source: 'Finnhub',
      fetchedAt: Date.now(),
    }
  } catch (err) {
    console.warn('Finnhub quote failed', err instanceof Error ? err.message : err)
    return null
  }
}

async function fetchFromMassive(symbol: string): Promise<QuoteResult | null> {
  if (!MASSIVE_KEY) return null
  try {
    // Massive.com (Polygon) previous close with latest trade
    const lastUrl = `https://api.massive.com/v2/last/trade/${symbol}?apiKey=${MASSIVE_KEY}`
    const prevUrl = `https://api.massive.com/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${MASSIVE_KEY}`

    const [last, prev] = await Promise.all([
      safeGet<any>(lastUrl),
      safeGet<any>(prevUrl).catch(() => null),
    ])

    const lastTrade = last?.results
    if (!lastTrade) return null

    const price = Number(lastTrade.p)
    let prevClose = price
    if (prev?.results?.[0]?.c) {
      prevClose = Number(prev.results[0].c)
    }
    const change = price - prevClose
    const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0

    return {
      symbol,
      price,
      change,
      changePct,
      previousClose: prevClose,
      volume: lastTrade.s ?? undefined,
      currency: 'USD',
      source: 'Massive',
      fetchedAt: Date.now(),
    }
  } catch (err) {
    console.warn('Massive quote failed', err instanceof Error ? err.message : err)
    return null
  }
}

async function fetchFromTwelveData(symbol: string): Promise<QuoteResult | null> {
  if (!TWELVE_KEY) return null
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_KEY}`
    const data = await safeGet<any>(url)
    if (!data || data.code || !data.close) return null

    const price = Number(data.close)
    const prevClose = Number(data.previous_close || price)
    const change = price - prevClose
    const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0

    return {
      symbol,
      price,
      change,
      changePct,
      open: Number(data.open) || undefined,
      high: Number(data.high) || undefined,
      low: Number(data.low) || undefined,
      previousClose: prevClose,
      volume: data.volume ? Number(data.volume) : undefined,
      currency: data.currency || 'USD',
      source: 'TwelveData',
      fetchedAt: Date.now(),
    }
  } catch (err) {
    console.warn('Twelve Data quote failed', err instanceof Error ? err.message : err)
    return null
  }
}

async function fetchFromAlphaVantage(symbol: string): Promise<QuoteResult | null> {
  if (!ALPHA_KEY) return null
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_KEY}`
    const data = await safeGet<any>(url)
    const quote = data?.['Global Quote']
    if (!quote || !quote['05. price']) return null

    const price = Number(quote['05. price'])
    const prevClose = Number(quote['08. previous close'] || price)
    const change = Number(quote['09. change'] || price - prevClose)
    const changePct = Number((quote['10. change percent'] || '0%').replace('%', ''))

    return {
      symbol,
      price,
      change,
      changePct,
      open: Number(quote['02. open']) || undefined,
      high: Number(quote['03. high']) || undefined,
      low: Number(quote['04. low']) || undefined,
      previousClose: prevClose,
      volume: Number(quote['06. volume']) || undefined,
      currency: 'USD',
      source: 'AlphaVantage',
      fetchedAt: Date.now(),
    }
  } catch (err) {
    console.warn('Alpha Vantage quote failed', err instanceof Error ? err.message : err)
    return null
  }
}

function cacheKeyForQuote(symbol: string) {
  return `quote:${symbol.toUpperCase()}`
}

export async function getQuoteWithFallback(symbolInput: string): Promise<QuoteResult> {
  const symbol = symbolInput.toUpperCase()
  const cacheKey = cacheKeyForQuote(symbol)
  const cached = getFromCache<QuoteResult>(cacheKey)
  if (cached && !cached.isStale) {
    return { ...cached.value, source: `${cached.value.source}, Cached`, stale: false }
  }

  const providers = [fetchFromFinnhub, fetchFromMassive, fetchFromTwelveData, fetchFromAlphaVantage]
  const errors: string[] = []
  for (const provider of providers) {
    try {
      const result = await provider(symbol)
      if (result) {
        setCache(cacheKey, result, QUOTE_CACHE_TTL_MS)
        return result
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  // if we reach here and we have stale cached data, return it marked stale
  if (cached) {
    const staleAge = Date.now() - cached.value.fetchedAt
    if (staleAge <= QUOTE_STALE_TTL_MS) {
      return { ...cached.value, stale: true, source: `${cached.value.source}, Cached` }
    }
  }

  const message = errors.length > 0 ? errors.join('; ') : 'All providers unavailable'
  throw new Error(`Quote unavailable for ${symbol}: ${message}`)
}


