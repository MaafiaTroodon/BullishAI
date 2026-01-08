import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'
import { getSession } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { ensurePortfolioLoaded, listPositions } from '@/lib/portfolio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PRIMARY_FMP = process.env.FINANCIALMODELINGPREP_API_KEY
const SECONDARY_FMP = process.env.FINANCIALMODELINGPREP_API_KEY_SECONDARY
const ALLOWED_EXCHANGES = ['NASDAQ', 'NYSE', 'AMEX', 'TSX']
const MIN_MARKET_CAP = 2_000_000_000

function clampRange(start: Date, end: Date) {
  const maxDays = 90
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000)
  if (diffDays > maxDays) {
    const capped = new Date(start)
    capped.setDate(capped.getDate() + maxDays)
    return { start, end: capped }
  }
  return { start, end }
}

async function fetchFmp(from: string, to: string) {
  const keys = [PRIMARY_FMP, SECONDARY_FMP].filter(Boolean) as string[]
  if (!keys.length) return []
  let lastStatus = 500
  for (const key of keys) {
    const url = `https://financialmodelingprep.com/stable/dividends-calendar?from=${from}&to=${to}&apikey=${key}`
    const res = await fetch(url, { cache: 'no-store' })
    lastStatus = res.status
    if (!res.ok && (res.status === 429 || res.status >= 500)) {
      continue
    }
    const data = await res.json().catch(() => [])
    return Array.isArray(data) ? data : []
  }
  console.warn('FMP dividends failed with status', lastStatus)
  return []
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const range = url.searchParams.get('range') || 'week'
    const symbolsParam = url.searchParams.get('symbols')

    const now = new Date()
    const startDate = new Date(now)
    const endDate = new Date(now)
    if (range === 'today') {
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)
    } else if (range === 'week') {
      endDate.setDate(endDate.getDate() + 7)
    } else {
      endDate.setDate(endDate.getDate() + 30)
    }

    const clamped = clampRange(startDate, endDate)
    const from = clamped.start.toISOString().split('T')[0]
    const to = clamped.end.toISOString().split('T')[0]

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

    try {
      const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`, { cache: 'no-store' })
      const popular = await popularRes.json().catch(() => ({ stocks: [] }))
      ;(popular.stocks || []).forEach((s: any) => universe.add(String(s.symbol || s).toUpperCase()))
    } catch {}

    if (symbolsParam) {
      symbolsParam
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .forEach((s) => universe.add(s))
    }

    if (universe.size === 0) {
      return NextResponse.json(
        { type: 'dividends', range, items: [], count: 0 },
        { headers: { 'Cache-Control': 's-maxage=1200, stale-while-revalidate=1800' } }
      )
    }

    const rawItems = await fetchFmp(from, to)
    if (!rawItems.length) {
      return NextResponse.json(
        { type: 'dividends', range, items: [], count: 0 },
        { headers: { 'Cache-Control': 's-maxage=1200, stale-while-revalidate=1800' } }
      )
    }

    const filteredByUniverse = rawItems.filter((item) => universe.has(String(item.symbol || '').toUpperCase()))
    if (!filteredByUniverse.length) {
      return NextResponse.json(
        { type: 'dividends', range, items: [], count: 0 },
        { headers: { 'Cache-Control': 's-maxage=1200, stale-while-revalidate=1800' } }
      )
    }

    const validated = await Promise.all(
      filteredByUniverse.map(async (item) => {
        const symbol = String(item.symbol || '').toUpperCase()
        const profileRes = await finnhubFetch('stock/profile2', { symbol }, { cacheSeconds: 3600 })
        const profile = profileRes.data || {}
        const name = profile?.name
        const exchange = String(profile?.exchange || '').toUpperCase()
        if (!name || !exchange) return null
        const exchangeOk = ALLOWED_EXCHANGES.some((ex) => exchange.includes(ex))
        if (!exchangeOk) {
          const metricRes = await finnhubFetch('stock/metric', { symbol, metric: 'all' }, { cacheSeconds: 3600 })
          const marketCap = Number(metricRes.data?.metric?.marketCapitalization || 0) * 1_000_000
          if (!Number.isFinite(marketCap) || marketCap < MIN_MARKET_CAP) return null
        }

        return {
          symbol,
          company: name,
          date: item.date,
          exDate: item.date,
          recordDate: item.recordDate || null,
          payDate: item.paymentDate || null,
          declarationDate: item.declarationDate || null,
          amount: item.dividend ?? item.adjDividend ?? null,
          yield: item.yield ?? null,
          currency: null,
          frequency: item.frequency || null,
          type: null,
        }
      })
    )

    const items = validated
      .filter((item): item is NonNullable<typeof item> => !!item && !!item.amount)
      .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())

    return NextResponse.json(
      { type: 'dividends', range, items, count: items.length },
      { headers: { 'Cache-Control': 's-maxage=1200, stale-while-revalidate=1800' } }
    )
  } catch (error: any) {
    console.error('Dividends calendar API error:', error)
    return NextResponse.json(
      { error: error.message || 'dividends_calendar_error', items: [], count: 0 },
      { status: 500 }
    )
  }
}
