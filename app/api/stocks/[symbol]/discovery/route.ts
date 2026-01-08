import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { symbol: string } }) {
  try {
    const symbol = params.symbol.toUpperCase()
    const [similarRes, themeRes, supplyRes] = await Promise.all([
      finnhubFetch('stock/similarity-index', { symbol }, { cacheSeconds: 86400 }),
      finnhubFetch('stock/investment-theme', { symbol }, { cacheSeconds: 86400 }),
      finnhubFetch('stock/supply-chain', { symbol }, { cacheSeconds: 86400 }),
    ])

    return NextResponse.json(
      {
        symbol,
        similar: similarRes.data || [],
        themes: themeRes.data || [],
        supplyChain: supplyRes.data || [],
      },
      {
        headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=86400' },
      }
    )
  } catch (error: any) {
    console.error('Discovery API error:', error)
    return NextResponse.json(
      { error: error.message || 'discovery_error' },
      { status: 500 }
    )
  }
}
