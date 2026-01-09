import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'
import { getHomeUniverse } from '@/lib/home-universe'
import { getFromCache, setCache } from '@/lib/providers/cache'
import { mapWithConcurrency } from '@/lib/async-limit'
import { getQuoteWithFallback } from '@/lib/providers/market-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function normalize(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || max === min) return 0
  return (value - min) / (max - min)
}

export async function GET(req: NextRequest) {
  try {
    const cacheKey = 'home:top-picks'
    const cached = getFromCache<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached.value, {
        headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=900' },
      })
    }

    const rows = await mapWithConcurrency(getHomeUniverse(120), 6, async (symbol) => {
      const [metricRes, quote] = await Promise.all([
        finnhubFetch('stock/metric', { symbol, metric: 'all' }, { cacheSeconds: 3600 }),
        getQuoteWithFallback(symbol).catch(() => null),
      ])
      const metric = metricRes.data?.metric || {}
      const changePercent = Number(quote?.changePct ?? 0)
      const pe = Number(metric.peTTM || metric.peNormalizedAnnual || 0)
      const marketCap = Number(metric.marketCapitalization || 0) * 1_000_000
      const logCap = marketCap > 0 ? Math.log10(marketCap) : 0

      return {
        symbol,
        price: Number(quote?.price ?? 0),
        changePercent,
        momentum_5d: changePercent,
        pe,
        marketCap,
        logCap,
      }
    })

    const cleaned = rows.filter((r): r is NonNullable<typeof r> => !!r && r.price > 0)
    if (cleaned.length === 0) {
      const fallback = await mapWithConcurrency(getHomeUniverse(10), 5, async (symbol) => {
        const quoteRes = await finnhubFetch('quote', { symbol }, { cacheSeconds: 30 })
        const quote = quoteRes.data || {}
        return {
          symbol,
          price: Number(quote.c ?? 0),
          changePercent: Number(quote.dp ?? 0),
          momentum_5d: Number(quote.dp ?? 0),
          pe: null,
          marketCap: null,
          logCap: 0,
          score: 0,
          reasonTag: 'Balanced',
        }
      })
      const payload = { stocks: fallback.filter((r) => r.price > 0).slice(0, 5), timestamp: Date.now(), source: 'Finnhub' }
      setCache(cacheKey, payload, 10 * 60 * 1000)
      return NextResponse.json(payload, {
        headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=900' },
      })
    }

    const changes = cleaned.map((r) => r.changePercent)
    const mom = cleaned.map((r) => r.momentum_5d)
    const peVals = cleaned.filter((r) => r.pe > 0).map((r) => r.pe)
    const caps = cleaned.map((r) => r.logCap)

    const minChange = Math.min(...changes)
    const maxChange = Math.max(...changes)
    const minMom = Math.min(...mom)
    const maxMom = Math.max(...mom)
    const minPe = peVals.length ? Math.min(...peVals) : 0
    const maxPe = peVals.length ? Math.max(...peVals) : 1
    const minCap = Math.min(...caps)
    const maxCap = Math.max(...caps)

    let ranked = cleaned
      .map((row) => {
        const normChange = normalize(row.changePercent, minChange, maxChange)
        const normMom = normalize(row.momentum_5d, minMom, maxMom)
        const normCap = normalize(row.logCap, minCap, maxCap)
        const valueScore = row.pe > 0 ? 1 - normalize(row.pe, minPe, maxPe) : 0
        const score = 0.35 * normChange + 0.35 * normMom + 0.2 * valueScore + 0.1 * normCap
        return { ...row, score, reasonTag: 'Balanced' }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    if (ranked.length < 3) {
      const res = await fetch(`${req.nextUrl.origin}/api/home/strongest-today`, { cache: 'no-store' }).catch(() => null)
      const fallback = res ? await res.json().catch(() => ({ stocks: [] })) : { stocks: [] }
      ranked = (fallback.stocks || []).slice(0, 5).map((item: any) => ({
        ...item,
        momentum_5d: item.changePercent ?? 0,
        reasonTag: 'Trend',
        score: 0,
      }))
    }

    const payload = { stocks: ranked, timestamp: Date.now(), source: 'Finnhub' }
    if (payload.stocks.length > 0) {
      setCache(cacheKey, payload, 10 * 60 * 1000)
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=900' },
    })
  } catch (error: any) {
    console.error('Home top picks error:', error)
    return NextResponse.json(
      { error: error.message || 'top_picks_error', stocks: [] },
      { status: 500 }
    )
  }
}
