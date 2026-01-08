import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const rangeFrom = from || new Date().toISOString().split('T')[0]
    const rangeTo = to || (() => {
      const d = new Date()
      d.setDate(d.getDate() + 14)
      return d.toISOString().split('T')[0]
    })()

    const econRes = await finnhubFetch('calendar/economic', { from: rangeFrom, to: rangeTo }, { cacheSeconds: 1200 })
    const items = econRes.data?.economicCalendar || []

    return NextResponse.json(
      {
        items,
        from: rangeFrom,
        to: rangeTo,
        source: 'Finnhub',
      },
      {
        headers: {
          'Cache-Control': 's-maxage=1200, stale-while-revalidate=1800',
        },
      }
    )
  } catch (error: any) {
    console.error('Macro calendar API error:', error)
    return NextResponse.json(
      { error: error.message || 'macro_calendar_error', items: [] },
      { status: 500 }
    )
  }
}
