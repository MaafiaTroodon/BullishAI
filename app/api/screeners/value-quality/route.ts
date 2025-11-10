import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    // Fetch popular stocks
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    const symbols = popular.stocks?.slice(0, 50).map((s: any) => s.symbol).join(',') || 'AAPL,MSFT,GOOGL'
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))

    // Filter for value + quality (PE < 15, mock ROE > 15%, mock revenue growth > 10%)
    const stocks = (quotes.quotes || [])
      .map((q: any) => {
        const pe = parseFloat(q.pe || Math.random() * 30 + 5)
        const roe = Math.random() * 20 + 10 // Mock ROE
        const revenueGrowth = Math.random() * 15 + 5 // Mock revenue growth
        
        return {
          symbol: q.symbol,
          name: q.name,
          pe,
          roe,
          revenue_growth: revenueGrowth,
          quality_score: (roe * 0.4 + revenueGrowth * 0.3 + (30 - pe) * 0.3), // Higher is better
          price: parseFloat(q.price || 0),
        }
      })
      .filter((s: any) => s.pe < 15 && s.roe > 15 && s.revenue_growth > 10)
      .sort((a: any, b: any) => b.quality_score - a.quality_score)
      .slice(0, 10)

    return NextResponse.json({
      stocks,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Value-quality screener API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch value-quality stocks' },
      { status: 500 }
    )
  }
}

