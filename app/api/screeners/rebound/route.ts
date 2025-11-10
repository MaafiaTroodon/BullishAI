import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    // Fetch popular stocks
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    const symbols = popular.stocks?.slice(0, 50).map((s: any) => s.symbol).join(',') || 'AAPL,MSFT,GOOGL'
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))

    // Filter for rebound candidates (RSI < 35, turning up)
    const stocks = (quotes.quotes || [])
      .map((q: any) => {
        // Handle both formats
        const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
        const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
        const name = q.name || q.symbol
        
        // Mock RSI calculation (simplified)
        const rsi = changePercent < -5 ? 30 + Math.random() * 10 : 40 + Math.random() * 20
        
        return {
          symbol: q.symbol,
          name,
          rsi,
          rsi_trend: changePercent > 0 && rsi < 35 ? 'turning_up' : 'oversold',
          price,
          support_level: price * 0.95, // Mock support
        }
      })
      .filter((s: any) => s.price > 0 && s.rsi < 35 && s.rsi_trend === 'turning_up')
      .sort((a: any, b: any) => a.rsi - b.rsi) // Lowest RSI first
      .slice(0, 10)

    return NextResponse.json({
      stocks,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Rebound screener API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch rebound candidates' },
      { status: 500 }
    )
  }
}

