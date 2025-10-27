import { NextRequest, NextResponse } from 'next/server'
import { getQuote as getFinnhubQuote } from '@/lib/finnhub'
import { getQuote as getTwelveDataQuote } from '@/lib/twelvedata'
import { z } from 'zod'

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

    let data
    let source = 'finnhub'

    try {
      // Try Finnhub first
      data = await getFinnhubQuote(validation.data.symbol)
      if (!data || data.c === 0) {
        throw new Error('No data')
      }
    } catch (error: any) {
      // Fallback to Twelve Data
      if (error.message === 'RATE_LIMIT' || error.message === 'No data') {
        try {
          data = await getTwelveDataQuote(validation.data.symbol)
          source = 'twelvedata'
        } catch (fallbackError) {
          return NextResponse.json(
            { error: 'Failed to fetch quote from all sources' },
            { status: 500 }
          )
        }
      } else {
        throw error
      }
    }

    return NextResponse.json({
      symbol: validation.data.symbol,
      price: data.c,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      timestamp: data.t,
      source,
    })
  } catch (error: any) {
    console.error('Quote API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

