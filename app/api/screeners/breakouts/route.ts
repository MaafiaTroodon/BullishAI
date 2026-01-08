import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'
import { DEFAULT_UNIVERSE } from '@/lib/universe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const universe = searchParams.get('universe') || 'default'

    let symbols: string[] = []
    try {
      const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`, { cache: 'no-store' })
      const popular = await popularRes.json().catch(() => ({ stocks: [] }))
      symbols = (popular.stocks || []).map((s: any) => s.symbol).filter(Boolean)
    } catch {}

    const symbolList = (universe === 'default' ? [...new Set([...symbols, ...DEFAULT_UNIVERSE])] : DEFAULT_UNIVERSE).slice(0, 25)

    const now = Math.floor(Date.now() / 1000)
    const from = now - 60 * 60 * 24 * 365

    const candidates = await Promise.all(
      symbolList.map(async (symbol) => {
        const [metricRes, candleRes, quoteRes] = await Promise.all([
          finnhubFetch('stock/price-metric', { symbol, metric: 'all' }, { cacheSeconds: 3600 }),
          finnhubFetch('stock/candle', { symbol, resolution: 'D', from, to: now }, { cacheSeconds: 300 }),
          finnhubFetch('quote', { symbol }, { cacheSeconds: 60 }),
        ])
        const metric = metricRes.data?.metric || {}
        const candle = candleRes.data || {}
        const quote = quoteRes.data || {}
        const closes = Array.isArray(candle.c) ? candle.c : []
        const volumes = Array.isArray(candle.v) ? candle.v : []
        if (closes.length < 10) return null
        const last = closes[closes.length - 1] || quote.c || 0
        const week52High = metric['52WeekHigh'] ?? metric['52WeekHighWithDate'] ?? metric.week52High
        const high = (week52High && Number.isFinite(week52High)) ? week52High : Math.max(...closes.slice(-252))
        const avgVolume = volumes.slice(-20).reduce((acc: number, v: number) => acc + v, 0) / Math.max(1, volumes.slice(-20).length)
        const lastVolume = volumes[volumes.length - 1] || quote.v || 0
        const volumeSpike = avgVolume ? lastVolume / avgVolume : null

        return {
          symbol,
          price: last,
          week52High: high,
          volumeSpike,
          changePercent: quote.dp || 0,
        }
      })
    )

    let filtered = candidates
      .filter((c): c is NonNullable<typeof c> => !!c && c.price > 0)
      .filter((c) => c.price >= (c.week52High || 0) * 0.995 && (c.volumeSpike ?? 0) >= 1.5)
      .sort((a, b) => (b.volumeSpike || 0) - (a.volumeSpike || 0))

    if (filtered.length === 0) {
      filtered = candidates
        .filter((c): c is NonNullable<typeof c> => !!c && c.price > 0)
        .filter((c) => c.price >= (c.week52High || 0) * 0.99 && (c.volumeSpike ?? 0) >= 1.3)
        .sort((a, b) => (b.volumeSpike || 0) - (a.volumeSpike || 0))
    }
    if (filtered.length === 0) {
      filtered = candidates
        .filter((c): c is NonNullable<typeof c> => !!c && c.price > 0)
        .sort((a, b) => (b.volumeSpike || 0) - (a.volumeSpike || 0))
    }

    const top = filtered.slice(0, 10)
    const toDate = new Date().toISOString().split('T')[0]
    const fromDate = (() => {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      return d.toISOString().split('T')[0]
    })()

    const withNews = await Promise.all(
      top.map(async (stock) => {
        const [newsRes, pressRes, sentimentRes] = await Promise.all([
          finnhubFetch('company-news', { symbol: stock.symbol, from: fromDate, to: toDate }, { cacheSeconds: 600 }),
          finnhubFetch('press-releases', { symbol: stock.symbol, from: fromDate, to: toDate }, { cacheSeconds: 600 }),
          finnhubFetch('news-sentiment', { symbol: stock.symbol }, { cacheSeconds: 600 }),
        ])
        const newsItems = Array.isArray(newsRes.data) ? newsRes.data : []
        const pressItems = Array.isArray(pressRes.data) ? pressRes.data : []
        const headline = pressItems.find((n) => n.headline) || newsItems.find((n) => n.headline) || null
        const sentiment = sentimentRes.data?.sentiment?.bullishPercent ?? null
        return {
          ...stock,
          reason: headline ? `${headline.headline} (${headline.source || 'News'})` : 'No major headline catalyst found.',
          sentiment,
        }
      })
    )

    return NextResponse.json(
      {
        items: withNews,
        stocks: withNews,
        timestamp: Date.now(),
        source: 'Finnhub',
      },
      {
        headers: {
          'Cache-Control': 's-maxage=180, stale-while-revalidate=300',
        },
      }
    )
  } catch (error: any) {
    console.error('Breakouts screener API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch breakouts' },
      { status: 500 }
    )
  }
}
