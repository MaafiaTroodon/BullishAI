import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol')?.toUpperCase() || 'SPY'

    // Fetch OHLC data
    const ohlcRes = await fetch(`${req.nextUrl.origin}/api/ohlc?symbol=${symbol}&tf=1d`)
    const ohlc = await ohlcRes.json().catch(() => ({ candles: [] }))

    // Calculate volatility (simplified - in production, use proper volatility calculation)
    const closes = (ohlc.candles || []).map((c: any) => parseFloat(c.close || 0))
    const returns = closes.slice(1).map((c: number, i: number) => (c - closes[i]) / closes[i])
    const volatility = returns.length > 0
      ? Math.sqrt(returns.reduce((sum: number, r: number) => sum + r * r, 0) / returns.length) * Math.sqrt(252) * 100
      : 20

    return NextResponse.json({
      symbol,
      volatility: volatility.toFixed(2),
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Volatility API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to calculate volatility' },
      { status: 500 }
    )
  }
}

