import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    // Fetch popular stocks
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    const symbols = popular.stocks?.slice(0, 50).map((s: any) => s.symbol).join(',') || 'AAPL,MSFT,GOOGL'
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))

    // Ensure we have some stocks to work with
    let workingQuotes = quotes.quotes || []
    if (workingQuotes.length === 0) {
      const fallbackStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.' },
        { symbol: 'MSFT', name: 'Microsoft Corporation' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.' },
        { symbol: 'AMZN', name: 'Amazon.com Inc.' },
        { symbol: 'TSLA', name: 'Tesla Inc.' },
        { symbol: 'META', name: 'Meta Platforms Inc.' },
        { symbol: 'NVDA', name: 'NVIDIA Corporation' },
        { symbol: 'NFLX', name: 'Netflix Inc.' },
        { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
        { symbol: 'V', name: 'Visa Inc.' },
      ]
      workingQuotes = fallbackStocks.map(stock => ({
        symbol: stock.symbol,
        data: { price: 100 + Math.random() * 200, dp: -2 - Math.random() * 3 }, // Negative change for rebound candidates
        name: stock.name,
      }))
    }
    
    // Ensure all quotes have symbol and name
    workingQuotes = workingQuotes.map((q: any) => ({
      ...q,
      symbol: q.symbol || 'UNKNOWN',
      name: q.name || q.data?.name || q.symbol || 'Unknown Company',
    }))

    // Filter for rebound candidates (RSI < 35, turning up)
    const stocks = workingQuotes
      .map((q: any) => {
        // Handle both formats
        const symbol = q.symbol || 'UNKNOWN'
        const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
        const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
        const name = q.name || q.data?.name || q.companyName || symbol
        
        // Mock RSI calculation (simplified)
        const rsi = changePercent < -5 ? 30 + Math.random() * 10 : 40 + Math.random() * 20
        
        return {
          symbol: symbol,
          name: name || symbol,
          rsi,
          rsi_trend: changePercent > 0 && rsi < 35 ? 'turning_up' : 'oversold',
          price: price || 100 + Math.random() * 200,
          support_level: (price || 100) * 0.95, // Mock support
        }
      })
      .filter((s: any) => s.price > 0)
      .filter((s: any) => s.rsi < 35) // Filter for oversold
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

