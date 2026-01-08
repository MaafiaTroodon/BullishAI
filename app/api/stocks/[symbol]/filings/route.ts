import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol: rawSymbol } = await params
    const symbol = rawSymbol.toUpperCase()
    const [filingsRes, sentimentRes] = await Promise.all([
      finnhubFetch('stock/filings', { symbol }, { cacheSeconds: 3600 }),
      finnhubFetch('stock/filings-sentiment', { symbol }, { cacheSeconds: 3600 }),
    ])

    return NextResponse.json(
      {
        symbol,
        filings: filingsRes.data || [],
        sentiment: sentimentRes.data || null,
      },
      {
        headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' },
      }
    )
  } catch (error: any) {
    console.error('Filings API error:', error)
    return NextResponse.json(
      { error: error.message || 'filings_error' },
      { status: 500 }
    )
  }
}
