import { NextRequest, NextResponse } from 'next/server'
import { getQuoteWithFallback } from '@/lib/providers/market-data'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const quoteSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      )
    }

    // Validate symbol
    const validation = quoteSchema.safeParse({ symbol })
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid symbol format' },
        { status: 400 }
      )
    }

    try {
      const quote = await getQuoteWithFallback(validation.data.symbol)
      return NextResponse.json({
        symbol: validation.data.symbol,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePct,
        high: quote.high,
        low: quote.low,
        open: quote.open,
        previousClose: quote.previousClose,
        volume: quote.volume,
        marketCap: quote.marketCap,
        currency: quote.currency || 'USD',
        source: quote.source,
        fetchedAt: quote.fetchedAt,
        stale: !!quote.stale,
      })
    } catch (error: any) {
      console.error('Quote fetch failed:', error?.message || error)

      return NextResponse.json(
        { error: 'quote_unavailable', message: error?.message || 'Failed to fetch quote', symbol: validation.data.symbol },
        { status: 502 }
      )
    }
  } catch (error: any) {
    console.error('Quote API error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
