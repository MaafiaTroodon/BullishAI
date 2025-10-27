import { NextRequest, NextResponse } from 'next/server'
import { getCandles } from '@/lib/market-data'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const chartSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  range: z.enum(['1d', '5d', '1m', '6m', '1y', '5y', 'max']).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')
    const range = searchParams.get('range') || '1m'

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      )
    }

    // Validate input
    const validation = chartSchema.safeParse({ symbol, range })
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      )
    }

    try {
      const result = await getCandles(validation.data.symbol, validation.data.range || '1m')
      
      return NextResponse.json({
        symbol: validation.data.symbol,
        range: validation.data.range,
        data: result.data,
        source: result.source, // Which provider served the data
      })
    } catch (error: any) {
      console.error('Chart fetch failed:', error.message)
      return NextResponse.json(
        { 
          symbol: validation.data.symbol,
          range: validation.data.range,
          data: [],
          source: 'none',
          error: `Fallback data unavailable for ${validation.data.symbol}. Please try another symbol.`
        },
        { status: 502 }
      )
    }
  } catch (error: any) {
    console.error('Chart API error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
