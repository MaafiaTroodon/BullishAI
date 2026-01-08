import { NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [statusRes, holidayRes] = await Promise.all([
      finnhubFetch('stock/market-status', {}, { cacheSeconds: 60 }),
      finnhubFetch('stock/market-holiday', {}, { cacheSeconds: 3600 }),
    ])

    const status = statusRes.data || {}
    const holidays = holidayRes.data || {}

    return NextResponse.json(
      {
        status,
        holidays,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  } catch (error: any) {
    console.error('Market status API error:', error)
    return NextResponse.json(
      { error: error.message || 'market_status_error' },
      { status: 500 }
    )
  }
}
