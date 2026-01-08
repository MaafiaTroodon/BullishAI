import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { symbol: string } }) {
  try {
    const symbol = params.symbol.toUpperCase()
    const [recRes, targetRes] = await Promise.all([
      finnhubFetch('stock/recommendation', { symbol }, { cacheSeconds: 3600 }),
      finnhubFetch('stock/price-target', { symbol }, { cacheSeconds: 3600 }),
    ])

    return NextResponse.json(
      {
        symbol,
        recommendation: recRes.data || [],
        priceTarget: targetRes.data || null,
      },
      {
        headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' },
      }
    )
  } catch (error: any) {
    console.error('Analyst API error:', error)
    return NextResponse.json(
      { error: error.message || 'analyst_error' },
      { status: 500 }
    )
  }
}
