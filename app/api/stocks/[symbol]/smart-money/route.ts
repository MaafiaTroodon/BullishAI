import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol: rawSymbol } = await params
    const symbol = rawSymbol.toUpperCase()

    const [ownershipRes, fundRes, instRes, insiderTxRes, insiderSentRes, congressRes] = await Promise.all([
      finnhubFetch('stock/ownership', { symbol }, { cacheSeconds: 3600 }),
      finnhubFetch('stock/fund-ownership', { symbol }, { cacheSeconds: 3600 }),
      finnhubFetch('institutional/portfolio', { symbol }, { cacheSeconds: 3600 }),
      finnhubFetch('stock/insider-transactions', { symbol }, { cacheSeconds: 3600 }),
      finnhubFetch('stock/insider-sentiment', { symbol, from: '2024-01-01', to: new Date().toISOString().split('T')[0] }, { cacheSeconds: 3600 }),
      finnhubFetch('stock/congressional-trading', { symbol }, { cacheSeconds: 3600 }),
    ])

    return NextResponse.json(
      {
        symbol,
        ownership: ownershipRes.data || null,
        fundOwnership: fundRes.data || null,
        institutionalPortfolio: instRes.data || null,
        insiderTransactions: insiderTxRes.data || null,
        insiderSentiment: insiderSentRes.data || null,
        congressionalTrading: congressRes.data || null,
      },
      {
        headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' },
      }
    )
  } catch (error: any) {
    console.error('Smart money API error:', error)
    return NextResponse.json(
      { error: error.message || 'smart_money_error' },
      { status: 500 }
    )
  }
}
