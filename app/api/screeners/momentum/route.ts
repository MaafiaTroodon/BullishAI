import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const window = searchParams.get('window') || '5d'

    // Fetch popular stocks
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    const symbols = popular.stocks?.slice(0, 50).map((s: any) => s.symbol).join(',') || 'AAPL,MSFT,GOOGL'
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))

    // Calculate momentum (simplified - in production, use actual historical data)
    const stocks = (quotes.quotes || [])
      .map((q: any) => {
        // Mock momentum calculation
        const momentum5d = parseFloat(q.changePercent || 0) * (window === '5d' ? 1.2 : 1)
        
        return {
          symbol: q.symbol,
          name: q.name,
          momentum_5d: momentum5d,
          volume: q.volume || 0,
          price: parseFloat(q.price || 0),
          change: parseFloat(q.changePercent || 0),
        }
      })
      .sort((a: any, b: any) => b.momentum_5d - a.momentum_5d)
      .slice(0, 10)

    return NextResponse.json({
      stocks,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Momentum screener API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch momentum stocks' },
      { status: 500 }
    )
  }
}

