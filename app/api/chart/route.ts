import { NextRequest, NextResponse } from 'next/server'
import { getHistoricalData } from '@/lib/finnhub'
import { z } from 'zod'

const chartSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  range: z.enum(['1d', '5d', '1m', '6m', '1y']),
})

const RESOLUTION_MAP = {
  '1d': '5',
  '5d': '15',
  '1m': 'D',
  '6m': 'D',
  '1y': 'W',
}

const LOOKBACK_MAP = {
  '1d': 1,
  '5d': 5,
  '1m': 30,
  '6m': 180,
  '1y': 365,
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')
    const range = searchParams.get('range') || '1d'

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

    const resolution = RESOLUTION_MAP[validation.data.range]
    const lookbackDays = LOOKBACK_MAP[validation.data.range]

    // Calculate timestamps
    const to = Math.floor(Date.now() / 1000)
    const from = to - lookbackDays * 24 * 60 * 60

    const data = await getHistoricalData(
      validation.data.symbol,
      resolution,
      from,
      to
    )

    if (!data || data.s !== 'ok' || !data.c) {
      return NextResponse.json(
        { error: 'No chart data available' },
        { status: 404 }
      )
    }

    // Transform data to a more usable format
    const chartData = data.c.map((close, index) => ({
      timestamp: data.t[index] * 1000, // Convert to milliseconds
      close,
      high: data.h?.[index] || close,
      low: data.l?.[index] || close,
      open: data.o?.[index] || close,
      volume: data.v?.[index] || 0,
    }))

    return NextResponse.json({
      symbol: validation.data.symbol,
      range: validation.data.range,
      data: chartData,
    })
  } catch (error: any) {
    console.error('Chart API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

