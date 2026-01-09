import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'
import { getHomeUniverse } from '@/lib/home-universe'
import { getFromCache, setCache } from '@/lib/providers/cache'
import { mapWithConcurrency } from '@/lib/async-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export async function GET(req: NextRequest) {
  try {
    const cacheKey = 'home:strongest-momentum'
    const cached = getFromCache<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached.value, {
        headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=900' },
      })
    }

    const now = Math.floor(Date.now() / 1000)
    const from = now - 60 * 60 * 24 * 12

    const rows = await mapWithConcurrency(getHomeUniverse(120), 6, async (symbol) => {
      const candleRes = await finnhubFetch(
        'stock/candle',
        { symbol, resolution: 'D', from, to: now },
        { cacheSeconds: 300 }
      )
      const candle = candleRes.data || {}
      const closes = Array.isArray(candle.c) ? candle.c : []
      const volumes = Array.isArray(candle.v) ? candle.v : []
      if (closes.length < 6) return null

      const last = closes[closes.length - 1]
      const base = closes[closes.length - 6]
      const momentum5d = base ? ((last - base) / base) * 100 : 0
      const avgVolume = average(volumes.slice(-20))
      const lastVolume = volumes[volumes.length - 1] || 0
      const volumeOk = avgVolume ? lastVolume >= avgVolume : false

      return {
        symbol,
        price: last,
        momentum_5d: momentum5d,
        volume: lastVolume,
        volumeOk,
      }
    })

    let ranked = rows
      .filter((r): r is NonNullable<typeof r> => !!r && r.price > 0)
      .filter((r) => r.volumeOk)
      .sort((a, b) => b.momentum_5d - a.momentum_5d)

    if (ranked.length === 0) {
      ranked = rows
        .filter((r): r is NonNullable<typeof r> => !!r && r.price > 0)
        .sort((a, b) => b.momentum_5d - a.momentum_5d)
    }

    let selected = ranked.slice(0, 5)
    if (selected.length === 0) {
      const quotes = await mapWithConcurrency(getHomeUniverse(20), 5, async (symbol) => {
        const quoteRes = await finnhubFetch('quote', { symbol }, { cacheSeconds: 30 })
        const quote = quoteRes.data || {}
        return {
          symbol,
          price: Number(quote.c ?? 0),
          momentum_5d: Number(quote.dp ?? 0),
          volume: Number(quote.v ?? 0),
        }
      })
      selected = quotes
        .map((q) => ({ ...q, volumeOk: true }))
        .filter((q) => q.price > 0)
        .slice(0, 5)
    }

    if (selected.length < 3) {
      const res = await fetch(`${req.nextUrl.origin}/api/home/strongest-today`, { cache: 'no-store' }).catch(() => null)
      const fallback = res ? await res.json().catch(() => ({ stocks: [] })) : { stocks: [] }
      selected = (fallback.stocks || []).slice(0, 5).map((item: any) => ({
        ...item,
        momentum_5d: item.changePercent ?? 0,
      }))
    }

    const payload = { stocks: selected, timestamp: Date.now(), source: 'Finnhub' }
    setCache(cacheKey, payload, 10 * 60 * 1000)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=900' },
    })
  } catch (error: any) {
    console.error('Home strongest momentum error:', error)
    return NextResponse.json(
      { error: error.message || 'strongest_momentum_error', stocks: [] },
      { status: 500 }
    )
  }
}
