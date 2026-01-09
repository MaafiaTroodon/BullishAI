import { NextRequest, NextResponse } from 'next/server'
import { getHomeUniverse } from '@/lib/home-universe'
import { getFromCache, setCache } from '@/lib/providers/cache'
import { mapWithConcurrency } from '@/lib/async-limit'
import { getQuoteWithFallback } from '@/lib/providers/market-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const cacheKey = 'home:strongest-today'
    const cached = getFromCache<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached.value, {
        headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
      })
    }

    const quotes = await mapWithConcurrency(getHomeUniverse(150), 8, async (symbol) => {
      try {
        const quote = await getQuoteWithFallback(symbol)
        const price = Number(quote.price ?? 0)
        const changePercent = Number(quote.changePct ?? 0)
        if (!Number.isFinite(price) || price <= 0) return null
        return {
          symbol,
          price,
          changePercent,
          change: Number(quote.change ?? 0),
        }
      } catch {
        return null
      }
    })

    const ranked = quotes
      .filter((q): q is NonNullable<typeof q> => !!q)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 5)

    const payload = { stocks: ranked, timestamp: Date.now(), source: 'Finnhub' }
    setCache(cacheKey, payload, 5 * 60 * 1000)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error: any) {
    console.error('Home strongest today error:', error)
    return NextResponse.json(
      { error: error.message || 'strongest_today_error', stocks: [] },
      { status: 500 }
    )
  }
}
