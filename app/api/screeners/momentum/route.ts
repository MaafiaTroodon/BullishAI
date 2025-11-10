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
        // Handle both formats
        const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
        const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
        const volume = q.data ? (q.data.volume || 0) : (q.volume || 0)
        const name = q.name || q.symbol
        
        // Mock momentum calculation
        const momentum5d = changePercent * (window === '5d' ? 1.2 : 1)
        
        return {
          symbol: q.symbol,
          name,
          momentum_5d: momentum5d,
          volume,
          price,
          change: changePercent,
        }
      })
      .filter((s: any) => s.price > 0)
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

