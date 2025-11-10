import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Fetch popular stocks
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    const symbols = popular.stocks?.slice(0, 20).map((s: any) => s.symbol).join(',') || 'AAPL,MSFT,GOOGL,AMZN,TSLA'
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))

    // Sort by absolute change percent
    const movers = (quotes.quotes || [])
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.name,
        price: parseFloat(q.price || 0),
        change: parseFloat(q.change || 0),
        changePercent: parseFloat(q.changePercent || 0),
        volume: q.volume || 0,
      }))
      .sort((a: any, b: any) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, limit)

    return NextResponse.json({
      movers,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Top movers API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch top movers' },
      { status: 500 }
    )
  }
}

