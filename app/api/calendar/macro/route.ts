import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'
import { getFromCache, setCache } from '@/lib/providers/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const cacheKey = `calendar:macro:${from || 'auto'}:${to || 'auto'}`
    const cached = getFromCache<any>(cacheKey)
    if (cached && !cached.isStale) {
      return NextResponse.json(cached.value, {
        headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' },
      })
    }
    const rangeFrom = from || new Date().toISOString().split('T')[0]
    const rangeTo = to || (() => {
      const d = new Date()
      d.setDate(d.getDate() + 14)
      return d.toISOString().split('T')[0]
    })()

    const econRes = await finnhubFetch('calendar/economic', { from: rangeFrom, to: rangeTo }, { cacheSeconds: 1200 })
    const items = econRes.data?.economicCalendar || []

    const payload = {
      items,
      from: rangeFrom,
      to: rangeTo,
      source: 'Finnhub',
    }
    setCache(cacheKey, payload, 60 * 60 * 1000)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch (error: any) {
    console.error('Macro calendar API error:', error)
    return NextResponse.json(
      { error: error.message || 'macro_calendar_error', items: [] },
      { status: 500 }
    )
  }
}
