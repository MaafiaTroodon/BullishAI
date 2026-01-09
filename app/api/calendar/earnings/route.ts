import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'
import { getFromCache, setCache } from '@/lib/providers/cache'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/earnings
 * Fetch earnings calendar from multiple sources
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const range = url.searchParams.get('range') || 'week'
    const fromParam = url.searchParams.get('from')
    const toParam = url.searchParams.get('to')

    const cacheKey = `calendar:earnings:${range}:${fromParam || 'auto'}:${toParam || 'auto'}`
    const cached = getFromCache<any>(cacheKey)
    if (cached && !cached.isStale) {
      return NextResponse.json(cached.value, {
        headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' },
      })
    }
    
    // Determine date range (forward-looking)
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
    
    const from = fromParam || startDate.toISOString().split('T')[0]
    const to = toParam || endDate.toISOString().split('T')[0]

    let items: any[] = []

    try {
      const res = await finnhubFetch('calendar/earnings', { from, to }, { cacheSeconds: 900 })
      if (res.ok && res.data?.earningsCalendar && Array.isArray(res.data.earningsCalendar)) {
        items = res.data.earningsCalendar.map((e: any) => ({
          symbol: e.symbol,
          company: e.name,
          date: e.date,
          time: e.hour || 'Before Market',
          estimate: e.epsEstimate ? parseFloat(e.epsEstimate) : null,
          actual: e.epsActual ? parseFloat(e.epsActual) : null,
          revenueEstimate: e.revenueEstimate ? parseFloat(e.revenueEstimate) : null,
          revenueActual: e.revenueActual ? parseFloat(e.revenueActual) : null,
        }))
      }
    } catch (err) {
      console.error('Finnhub earnings error:', err)
    }

    // Fallback: use Alpha Vantage if available
    if (items.length === 0) {
      try {
        const avKey = process.env.ALPHAVANTAGE_API_KEY
        if (avKey) {
          // Alpha Vantage doesn't have a direct earnings calendar, so we'll use a fallback
          // In production, you might want to use a different provider
        }
      } catch (err) {
        console.error('Alpha Vantage earnings error:', err)
      }
    }

    const symbols = items.map((item) => item.symbol).filter(Boolean)
    const uniqueSymbols = Array.from(new Set(symbols)).slice(0, 25)
    const beatMap = new Map<string, string>()

    await Promise.all(
      uniqueSymbols.map(async (symbol) => {
        const earningsRes = await finnhubFetch('stock/earnings', { symbol }, { cacheSeconds: 3600 })
        const history = Array.isArray(earningsRes.data) ? earningsRes.data : []
        const latest = history.find((entry) => entry?.actual !== undefined && entry?.estimate !== undefined)
        if (latest) {
          if (latest.actual > latest.estimate) beatMap.set(symbol, 'beat')
          else if (latest.actual < latest.estimate) beatMap.set(symbol, 'miss')
          else beatMap.set(symbol, 'inline')
          return
        }
        const financialsRes = await finnhubFetch('stock/financials-reported', { symbol, freq: 'quarterly' }, { cacheSeconds: 3600 })
        const reports = Array.isArray(financialsRes.data?.data) ? financialsRes.data.data : []
        if (reports.length > 0) {
          beatMap.set(symbol, 'reported')
        }
      })
    )

    // Sort by date
    items.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime()
      const dateB = new Date(b.date || 0).getTime()
      return dateA - dateB
    })

    const enriched = items.map((item) => ({
      ...item,
      lastQuarter: beatMap.get(item.symbol) || null,
    }))

    const payload = {
      items: enriched,
      count: enriched.length,
      range,
      from,
      to,
    }
    setCache(cacheKey, payload, 60 * 60 * 1000)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch (error: any) {
    console.error('Earnings calendar API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch earnings calendar', items: [] },
      { status: 500 }
    )
  }
}
