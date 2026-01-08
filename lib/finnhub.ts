import { finnhubFetch } from '@/lib/finnhub-client'

interface QuoteResponse {
  c: number // current price
  d: number // change
  dp: number // percent change
  h: number // high
  l: number // low
  o: number // open
  pc: number // previous close
  t: number // timestamp
}

export async function getQuote(symbol: string): Promise<QuoteResponse | null> {
  const response = await finnhubFetch<QuoteResponse>('quote', { symbol }, { cacheSeconds: 60 })
  if (!response.ok) return null
  return response.data
}

export async function getCompanyNews(symbol: string, limit = 5) {
  const from = new Date()
  from.setDate(from.getDate() - 7)
  const response = await finnhubFetch<any[]>(
    'company-news',
    { symbol, from: from.toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] },
    { cacheSeconds: 600 }
  )
  if (!response.ok || !Array.isArray(response.data)) return []
  return response.data.slice(0, limit) || []
}

export async function searchSymbol(query: string) {
  const response = await finnhubFetch<any>('search', { q: query }, { cacheSeconds: 300 })
  if (!response.ok) return []
  return response.data?.result || []
}

export async function getHistoricalData(
  symbol: string,
  resolution: string,
  from: number,
  to: number
) {
  const response = await finnhubFetch<any>('stock/candle', { symbol, resolution, from, to }, { cacheSeconds: 300 })
  if (!response.ok) return []
  return response.data
}
