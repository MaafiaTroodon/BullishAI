import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'
import { DEFAULT_UNIVERSE } from '@/lib/universe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getDateRange(days: number) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

async function loadUniverse(origin: string) {
  try {
    const res = await fetch(`${origin}/api/popular-stocks`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({ stocks: [] }))
    if (Array.isArray(data.stocks) && data.stocks.length > 0) return data.stocks
  } catch {}
  return DEFAULT_UNIVERSE
}

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin
    const universe = await loadUniverse(origin)
    const { from, to } = getDateRange(30)

    const quotes = await Promise.all(
      universe.map(async (symbol: string) => {
        const [quoteRes, candleRes] = await Promise.all([
          finnhubFetch('quote', { symbol }, { cacheSeconds: 60 }),
          finnhubFetch(
            'stock/candle',
            {
              symbol,
              resolution: 'D',
              from: Math.floor(new Date(from).getTime() / 1000),
              to: Math.floor(new Date(to).getTime() / 1000),
            },
            { cacheSeconds: 300 }
          ),
        ])

        const quote = quoteRes.data || {}
        const candle = candleRes.data || {}
        const closes = Array.isArray(candle.c) ? candle.c : []
        const volumes = Array.isArray(candle.v) ? candle.v : []
        const lastClose = closes[closes.length - 1] || quote.c || 0
        const prevClose = closes[closes.length - 2] || quote.pc || lastClose
        const changePercent = prevClose ? ((lastClose - prevClose) / prevClose) * 100 : quote.dp || 0
        const avgVolume = volumes.slice(-20).reduce((acc: number, v: number) => acc + v, 0) / Math.max(1, volumes.slice(-20).length)
        const lastVolume = volumes[volumes.length - 1] || quote.v || 0
        const volumeSpike = avgVolume ? lastVolume / avgVolume : null

        return {
          symbol,
          price: lastClose,
          changePercent,
          volume: lastVolume,
          avgVolume,
          volumeSpike,
        }
      })
    )

    const sorted = quotes.filter((q) => Number.isFinite(q.price) && q.price > 0)
      .sort((a, b) => b.changePercent - a.changePercent)

    const gainers = sorted.slice(0, 5)
    const losers = sorted.slice(-5).reverse()

    const { from: newsFrom, to: newsTo } = getDateRange(7)
    const newsFor = async (symbol: string) => {
      const res = await finnhubFetch('company-news', { symbol, from: newsFrom, to: newsTo }, { cacheSeconds: 600 })
      const items = Array.isArray(res.data) ? res.data : []
      const top = items.find((item) => item?.headline || item?.summary)
      return top
        ? { headline: top.headline || top.summary, source: top.source || 'News', datetime: top.datetime }
        : null
    }

    const withNews = async (items: any[]) => Promise.all(
      items.map(async (item) => ({
        ...item,
        headline: await newsFor(item.symbol),
      }))
    )

    const [gainersWithNews, losersWithNews] = await Promise.all([
      withNews(gainers),
      withNews(losers),
    ])

    return NextResponse.json(
      {
        gainers: gainersWithNews,
        losers: losersWithNews,
        source: 'Finnhub',
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 's-maxage=120, stale-while-revalidate=180',
        },
      }
    )
  } catch (error: any) {
    console.error('Home movers API error:', error)
    return NextResponse.json(
      { error: error.message || 'home_movers_error', gainers: [], losers: [] },
      { status: 500 }
    )
  }
}
