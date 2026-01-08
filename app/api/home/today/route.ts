import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getRange(days: number) {
  const from = new Date()
  const to = new Date()
  to.setDate(to.getDate() + days)
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

export async function GET(_req: NextRequest) {
  try {
    const { from, to } = getRange(7)
    const [earningsRes, ipoRes, econRes] = await Promise.all([
      finnhubFetch('calendar/earnings', { from, to }, { cacheSeconds: 900 }),
      finnhubFetch('calendar/ipo', { from, to }, { cacheSeconds: 900 }),
      finnhubFetch('calendar/economic', { from, to }, { cacheSeconds: 900 }),
    ])

    return NextResponse.json(
      {
        earnings: earningsRes.data?.earningsCalendar || [],
        ipos: ipoRes.data?.ipoCalendar || [],
        economic: econRes.data?.economicCalendar || [],
        from,
        to,
        source: 'Finnhub',
      },
      {
        headers: {
          'Cache-Control': 's-maxage=900, stale-while-revalidate=1800',
        },
      }
    )
  } catch (error: any) {
    console.error('Home today API error:', error)
    return NextResponse.json(
      { error: error.message || 'home_today_error', earnings: [], ipos: [], economic: [] },
      { status: 500 }
    )
  }
}
