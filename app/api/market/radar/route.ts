import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CacheEntry = {
  ts: number
  data: any
}

const CACHE_TTL_MS = 15_000
const cache = new Map<string, CacheEntry>()

async function fetchPopular(req: NextRequest) {
  try {
    const res = await fetch(`${req.nextUrl.origin}/api/popular-stocks`, { cache: 'no-store' })
    const data = await res.json()
    return Array.isArray(data?.stocks) ? data.stocks : []
  } catch {
    return []
  }
}

async function fetchTopMovers(req: NextRequest) {
  try {
    const res = await fetch(`${req.nextUrl.origin}/api/market/top-movers?limit=5`, { cache: 'no-store' })
    const data = await res.json()
    return Array.isArray(data?.movers) ? data.movers : []
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const market = (searchParams.get('market') || 'US').toUpperCase()
  const cacheKey = `radar-${market}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data)
  }

  const now = Date.now()
  const buysWindow = new Date(now - 15 * 60 * 1000)
  const watchlistWindow = new Date(now - 10 * 60 * 1000)

  let mostBuys: { symbol: string; count: number } | null = null
  let watchlistSurge: { symbol: string; count: number } | null = null

  try {
    const buyGroups = await db.trade.groupBy({
      by: ['symbol'],
      where: {
        action: 'buy',
        timestamp: { gte: buysWindow },
      },
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } },
      take: 1,
    })
    if (buyGroups.length > 0) {
      mostBuys = { symbol: buyGroups[0].symbol, count: buyGroups[0]._count._all }
    }
  } catch (error: any) {
    console.warn('[radar] trade query failed:', error?.message || error)
  }

  try {
    const watchlistGroups = await db.watchlistItem.groupBy({
      by: ['symbol'],
      where: {
        createdAt: { gte: watchlistWindow },
      },
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } },
      take: 1,
    })
    if (watchlistGroups.length > 0) {
      watchlistSurge = { symbol: watchlistGroups[0].symbol, count: watchlistGroups[0]._count._all }
    }
  } catch (error: any) {
    console.warn('[radar] watchlist query failed:', error?.message || error)
  }

  const movers = await fetchTopMovers(req)
  const popular = await fetchPopular(req)
  const fallbackSymbols = popular.map((s: any) => s.symbol).filter(Boolean)

  const topMover = movers[0]?.symbol || fallbackSymbols[0] || 'AAPL'
  const radarItems = [
    {
      type: 'Most simulated buys',
      emoji: '🔥',
      symbol: mostBuys?.symbol || topMover,
      value: mostBuys ? `${mostBuys.count} demo buys (last 15 min)` : 'Trending in BullishAI',
    },
    {
      type: 'Watchlist surge',
      emoji: '⭐',
      symbol: watchlistSurge?.symbol || fallbackSymbols[1] || topMover,
      value: watchlistSurge ? `${watchlistSurge.count} adds (last 10 min)` : 'Rising watch interest',
    },
    {
      type: 'Top AI-flagged',
      emoji: '🤖',
      symbol: movers[1]?.symbol || fallbackSymbols[2] || topMover,
      value: movers[1]?.changePercent !== undefined
        ? `High momentum + ${movers[1].changePercent.toFixed(2)}% move`
        : 'High momentum + volume spike',
    },
  ]

  const payload = { market, items: radarItems, updatedAt: now }
  cache.set(cacheKey, { ts: now, data: payload })
  return NextResponse.json(payload)
}
