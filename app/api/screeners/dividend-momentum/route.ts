import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    // Fetch popular stocks
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    const symbols = popular.stocks?.slice(0, 50).map((s: any) => s.symbol).join(',') || 'AAPL,MSFT,GOOGL'
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))

    // Filter for dividend + momentum (yield >= 2%, high relative strength)
    const stocks = (quotes.quotes || [])
      .map((q: any) => {
        const price = parseFloat(q.price || 0)
        const change = parseFloat(q.changePercent || 0)
        // Mock dividend yield and relative strength
        const dividendYield = Math.random() * 4 + 1 // 1-5%
        const relativeStrength = Math.abs(change) + Math.random() * 5
        
        return {
          symbol: q.symbol,
          name: q.name,
          dividend_yield: dividendYield,
          relative_strength: relativeStrength,
          price,
          change,
        }
      })
      .filter((s: any) => s.dividend_yield >= 2 && s.relative_strength > 3)
      .sort((a: any, b: any) => b.relative_strength - a.relative_strength)
      .slice(0, 10)

    return NextResponse.json({
      stocks,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Dividend-momentum screener API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dividend-momentum stocks' },
      { status: 500 }
    )
  }
}

