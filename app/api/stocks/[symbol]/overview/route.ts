import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { symbol: string } }) {
  try {
    const symbol = params.symbol.toUpperCase()
    const [profileRes, execRes, peersRes, metricRes] = await Promise.all([
      finnhubFetch('stock/profile2', { symbol }, { cacheSeconds: 86400 }),
      finnhubFetch('stock/executive', { symbol }, { cacheSeconds: 86400 }),
      finnhubFetch('stock/peers', { symbol }, { cacheSeconds: 86400 }),
      finnhubFetch('stock/metric', { symbol, metric: 'all' }, { cacheSeconds: 3600 }),
    ])

    return NextResponse.json(
      {
        symbol,
        profile: profileRes.data || null,
        executive: execRes.data || null,
        peers: peersRes.data || [],
        metrics: metricRes.data?.metric || null,
      },
      {
        headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' },
      }
    )
  } catch (error: any) {
    console.error('Overview API error:', error)
    return NextResponse.json(
      { error: error.message || 'overview_error' },
      { status: 500 }
    )
  }
}
