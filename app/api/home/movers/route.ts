import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'
import { DEFAULT_UNIVERSE } from '@/lib/universe'
import { getSession } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { ensurePortfolioLoaded, listPositions } from '@/lib/portfolio'
import { getFromCache, setCache } from '@/lib/providers/cache'
import { mapWithConcurrency } from '@/lib/async-limit'

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

const REPUTABLE_SOURCES = [
  'reuters',
  'bloomberg',
  'cnbc',
  'wsj',
  'wall street journal',
  'new york times',
  'nytimes',
  'financial times',
  'ft',
  'marketwatch',
  'barrons',
  'seekingalpha',
  'yahoo finance',
]

function normalizeCompanyName(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|co|company|ltd|plc|holdings|group|class|limited)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function headlineMatches(headline: string, symbol: string, companyName?: string) {
  const text = headline.toLowerCase()
  const ticker = symbol.toLowerCase()
  if (text.includes(`$${ticker}`) || text.includes(` ${ticker} `) || text.startsWith(`${ticker} `)) {
    return true
  }
  const name = companyName ? normalizeCompanyName(companyName) : ''
  if (name && text.includes(name)) return true
  return false
}

function scoreHeadline(item: any, symbol: string, companyName?: string) {
  const headline = String(item?.headline || item?.summary || '')
  if (!headline) return -1
  let score = 0
  if (headlineMatches(headline, symbol, companyName)) score += 3
  const source = String(item?.source || '').toLowerCase()
  if (REPUTABLE_SOURCES.some((s) => source.includes(s))) score += 1
  return score
}

export async function GET(req: NextRequest) {
  try {
    const cacheKey = 'home:movers'
    const cached = getFromCache<any>(cacheKey)
    if (cached && !cached.isStale) {
      return NextResponse.json(cached.value, {
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
      })
    }

    const origin = req.nextUrl.origin
    const session = await getSession()
    const userId = session?.user?.id || null
    const universe = new Set<string>()

    if (userId) {
      try {
        await ensurePortfolioLoaded(userId)
        listPositions(userId).forEach((p) => universe.add(p.symbol.toUpperCase()))
      } catch {}
      try {
        const watchlistItems = await db.watchlistItem.findMany({
          where: { watchlist: { userId } },
          select: { symbol: true },
        })
        watchlistItems.forEach((item) => universe.add(item.symbol.toUpperCase()))
      } catch {}
    }

    const popular = await loadUniverse(origin)
    popular.forEach((s) => universe.add(String(s).toUpperCase()))
    DEFAULT_UNIVERSE.forEach((s) => universe.add(s))

    const symbols = Array.from(universe).slice(0, 50)
    const quotes = await mapWithConcurrency(symbols, 8, async (symbol: string) => {
      const quoteRes = await finnhubFetch('quote', { symbol }, { cacheSeconds: 30 })
      const quote = quoteRes.data || {}
      const changePercent = Number(quote.dp || 0)
      const price = Number(quote.c || 0)
      return {
        symbol,
        price,
        changePercent,
        volume: Number(quote.v || 0),
      }
    })

    const sorted = quotes.filter((q) => Number.isFinite(q.price) && q.price > 0)
      .sort((a, b) => b.changePercent - a.changePercent)

    const gainers = sorted.slice(0, 5)
    const losers = sorted.slice(-5).reverse()

    const { from: newsFrom, to: newsTo } = getDateRange(7)
    const newsFor = async (symbol: string) => {
      const [profileRes, newsRes] = await Promise.all([
        finnhubFetch('stock/profile2', { symbol }, { cacheSeconds: 3600 }),
        finnhubFetch('company-news', { symbol, from: newsFrom, to: newsTo }, { cacheSeconds: 600 }),
      ])
      const companyName = profileRes.data?.name ? String(profileRes.data.name) : ''
      const items = Array.isArray(newsRes.data) ? newsRes.data : []
      const ranked = items
        .map((item) => ({ item, score: scoreHeadline(item, symbol, companyName) }))
        .filter((entry) => entry.score >= 3)
        .sort((a, b) => b.score - a.score)
      const top = ranked[0]?.item
      return top
        ? { headline: top.headline || top.summary, source: top.source || 'News', datetime: top.datetime }
        : null
    }

    const withNews = async (items: any[]) =>
      mapWithConcurrency(items, 6, async (item) => ({
        ...item,
        headline: await newsFor(item.symbol),
      }))

    const [gainersWithNews, losersWithNews] = await Promise.all([
      withNews(gainers),
      withNews(losers),
    ])

    const payload = {
      gainers: gainersWithNews,
      losers: losersWithNews,
      source: 'Finnhub',
      timestamp: new Date().toISOString(),
    }
    setCache(cacheKey, payload, 60 * 1000)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error: any) {
    console.error('Home movers API error:', error)
    return NextResponse.json(
      { error: error.message || 'home_movers_error', gainers: [], losers: [] },
      { status: 500 }
    )
  }
}
