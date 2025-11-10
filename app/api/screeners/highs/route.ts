import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    // Fetch popular stocks
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    const symbols = popular.stocks?.slice(0, 50).map((s: any) => s.symbol).join(',') || 'AAPL,MSFT,GOOGL'
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))

    // Filter for stocks near 52-week highs with high volume
    const breakouts = (quotes.quotes || [])
      .map((q: any) => {
        const price = parseFloat(q.price || 0)
        const high52w = parseFloat(q.high52w || price * 1.1)
        const volume = q.volume || 0
        const avgVolume = q.avgVolume || volume * 0.7
        const distanceFromHigh = ((high52w - price) / high52w) * 100
        
        return {
          symbol: q.symbol,
          name: q.name,
          price,
          '52w_high': high52w,
          volume_ratio: volume / (avgVolume || 1),
          change: parseFloat(q.changePercent || 0),
          distance_from_high: distanceFromHigh,
        }
      })
      .filter((b: any) => b.distance_from_high < 5 && b.volume_ratio > 1.5) // Within 5% of high, 1.5x volume
      .sort((a: any, b: any) => b.volume_ratio - a.volume_ratio)
      .slice(0, 10)

    return NextResponse.json({
      breakouts,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('52W highs API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch 52W highs' },
      { status: 500 }
    )
  }
}

