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

    // Normalize and sort by absolute change percent
    const movers = (quotes.quotes || [])
      .map((q: any) => {
        // Handle both formats: { symbol, data: {...} } and { symbol, price, ... }
        const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
        const change = q.data ? parseFloat(q.data.change || 0) : parseFloat(q.change || 0)
        const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
        const volume = q.data ? (q.data.volume || 0) : (q.volume || 0)
        
        return {
          symbol: q.symbol,
          name: q.name || q.symbol,
          price,
          change,
          changePercent,
          volume,
        }
      })
      .filter((m: any) => m.price > 0) // Only valid prices
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

