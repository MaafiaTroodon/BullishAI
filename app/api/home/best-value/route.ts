import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'
import { getHomeUniverse } from '@/lib/home-universe'
import { getFromCache, setCache } from '@/lib/providers/cache'
import { mapWithConcurrency } from '@/lib/async-limit'
import { getQuoteWithFallback } from '@/lib/providers/market-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIN_MARKET_CAP = 10_000_000_000

export async function GET(req: NextRequest) {
  try {
    const cacheKey = 'home:best-value'
    const cached = getFromCache<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached.value, {
        headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1200' },
      })
    }

    const metrics = await mapWithConcurrency(getHomeUniverse(120), 6, async (symbol) => {
      const metricRes = await finnhubFetch('stock/metric', { symbol, metric: 'all' }, { cacheSeconds: 3600 })
      const metric = metricRes.data?.metric || {}
      const marketCap = Number(metric.marketCapitalization || 0) * 1_000_000
      const pe = Number(metric.peTTM || metric.peNormalizedAnnual || 0)
      if (!Number.isFinite(marketCap) || marketCap < MIN_MARKET_CAP) return null
      return { symbol, marketCap, pe }
    })

    let ranked = metrics
      .filter((m): m is NonNullable<typeof m> => !!m)
      .filter((m) => m.pe > 0)
      .sort((a, b) => a.pe - b.pe)

    if (ranked.length === 0) {
      ranked = metrics
        .filter((m): m is NonNullable<typeof m> => !!m)
        .filter((m) => m.pe > 0)
        .sort((a, b) => a.pe - b.pe)
    }

    let top = ranked.slice(0, 5)
    if (top.length === 0) {
      const quotesFallback = await mapWithConcurrency(getHomeUniverse(20), 5, async (symbol) => {
        const quoteRes = await finnhubFetch('quote', { symbol }, { cacheSeconds: 120 })
        const quote = quoteRes.data || {}
        return {
          symbol,
          price: Number(quote.c ?? 0),
          changePercent: Number(quote.dp ?? 0),
          valueLabel: 'Value',
        }
      })
      top = quotesFallback.filter((q) => q.price > 0).slice(0, 5)
    }

    const withQuotes = await mapWithConcurrency(top, 5, async (item) => {
      const quote = await getQuoteWithFallback(item.symbol).catch(() => null)
      return {
        ...item,
        price: Number(quote?.price ?? 0),
        changePercent: Number(quote?.changePct ?? 0),
        valueLabel: item.pe ? `P/E ${item.pe.toFixed(1)}` : 'Value',
      }
    })

    let finalStocks = withQuotes
    if (finalStocks.length < 3) {
      const res = await fetch(`${req.nextUrl.origin}/api/home/strongest-today`, { cache: 'no-store' }).catch(() => null)
      const fallback = res ? await res.json().catch(() => ({ stocks: [] })) : { stocks: [] }
      finalStocks = (fallback.stocks || []).slice(0, 5).map((item: any) => ({
        ...item,
        valueLabel: 'Value',
      }))
    }

    const payload = { stocks: finalStocks, timestamp: Date.now(), source: 'Finnhub' }
    setCache(cacheKey, payload, 15 * 60 * 1000)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1200' },
    })
  } catch (error: any) {
    console.error('Home best value error:', error)
    return NextResponse.json(
      { error: error.message || 'best_value_error', stocks: [] },
      { status: 500 }
    )
  }
}
