import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    // Fetch popular stocks
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    const symbols = popular.stocks?.slice(0, 50).map((s: any) => s.symbol).join(',') || 'AAPL,MSFT,GOOGL,AMZN,TSLA'
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))

    // Calculate unusual volume (volume > 1.5x average)
    const stocks = (quotes.quotes || [])
      .map((q: any) => {
        const currentVolume = q.volume || 0
        const avgVolume = (q.avgVolume || currentVolume * 0.7) // Mock average
        const volumeRatio = currentVolume / (avgVolume || 1)
        
        return {
          symbol: q.symbol,
          name: q.name,
          volume_ratio: volumeRatio,
          avg_volume: avgVolume,
          current_volume: currentVolume,
          price_change: parseFloat(q.changePercent || 0),
          reason: volumeRatio > 1.5 ? 'Unusual volume spike' : 'Normal volume',
        }
      })
      .filter((s: any) => s.volume_ratio > 1.5)
      .sort((a: any, b: any) => b.volume_ratio - a.volume_ratio)
      .slice(0, 10)

    return NextResponse.json({
      stocks,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Unusual volume API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch unusual volume' },
      { status: 500 }
    )
  }
}

