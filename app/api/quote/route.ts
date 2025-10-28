import { NextRequest, NextResponse } from 'next/server'
import { getComprehensiveQuote } from '@/lib/comprehensive-quote'
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
      const data = await getComprehensiveQuote(validation.data.symbol)
      return NextResponse.json({
        symbol: validation.data.symbol,
        price: data.price,
        change: data.change,
        changePercent: data.changePct,
        high: data.high,
        low: data.low,
        open: data.open,
        previousClose: data.previousClose,
        volume: data.volume,
        marketCap: data.marketCap,
        peRatio: data.peRatio,
        week52High: data.week52High,
        week52Low: data.week52Low,
        source: data.source,
      })
    } catch (error: any) {
      console.error('Quote fetch failed:', error.message)
      return NextResponse.json(
        { error: 'Failed to fetch quote', symbol: validation.data.symbol },
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
