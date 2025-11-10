import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol')?.toUpperCase() || 'SPY'
    const tf = searchParams.get('tf') || '1d' // timeframe: 1h, 1d, 1w

    // Fetch chart data
    const chartRes = await fetch(`${req.nextUrl.origin}/api/chart?symbol=${symbol}&range=${tf === '1h' ? '1d' : tf === '1w' ? '1m' : '1m'}`)
    const chart = await chartRes.json().catch(() => ({ candles: [] }))

    // Format as OHLC
    const candles = (chart.candles || []).map((c: any) => ({
      time: c.t || Date.now(),
      open: parseFloat(c.o || c.open || 0),
      high: parseFloat(c.h || c.high || 0),
      low: parseFloat(c.l || c.low || 0),
      close: parseFloat(c.c || c.close || 0),
      volume: c.v || c.volume || 0,
    }))

    return NextResponse.json({
      symbol,
      timeframe: tf,
      candles,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('OHLC API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch OHLC data' },
      { status: 500 }
    )
  }
}

