import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const window = searchParams.get('window') || '5d'

    // Fetch popular stocks
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    // Always use fallback stocks to ensure we have proper data (US + Canadian)
    const fallbackStocks = [
      // US stocks
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
      // Canadian stocks
      { symbol: 'RY.TO', name: 'Royal Bank of Canada' },
      { symbol: 'TD.TO', name: 'Toronto-Dominion Bank' },
      { symbol: 'SHOP.TO', name: 'Shopify Inc.' },
      { symbol: 'CNQ.TO', name: 'Canadian Natural Resources' },
      { symbol: 'ENB.TO', name: 'Enbridge Inc.' },
      { symbol: 'TRP.TO', name: 'TC Energy Corporation' },
      { symbol: 'BAM.TO', name: 'Brookfield Asset Management' },
      { symbol: 'CP.TO', name: 'Canadian Pacific Kansas City' },
      { symbol: 'CNR.TO', name: 'Canadian National Railway' },
      { symbol: 'ATD.TO', name: 'Alimentation Couche-Tard' },
    ]
    
    const symbols = (popular.stocks || [])
      .slice(0, 30)
      .map((s: any) => s.symbol)
      .filter(Boolean)

    const symbolList = [...new Set([...symbols, ...fallbackStocks.map((s) => s.symbol)])].slice(0, 18)

    const stocks = await Promise.all(
      symbolList.map(async (symbol) => {
        try {
          const [quoteRes, chartRes] = await Promise.all([
            fetch(`${req.nextUrl.origin}/api/quote?symbol=${symbol}`),
            fetch(`${req.nextUrl.origin}/api/chart?symbol=${symbol}&range=1m`),
          ])
          const quote = await quoteRes.json().catch(() => null)
          const chart = await chartRes.json().catch(() => null)
          const data = Array.isArray(chart?.data) ? chart.data : []
          const closes = data
            .map((c: any) => (typeof c.c === 'number' ? c.c : c.close))
            .filter((n: number) => Number.isFinite(n))
          if (!quote?.price) return null
          const last = quote.price
          const priorIdx = closes.length >= 6 ? closes.length - 6 : 0
          const base = closes[priorIdx] || last
          const momentum5d = base ? ((last - base) / base) * 100 : quote.changePercent || 0
          let momentumLabel = 'Steady Momentum'
          if (momentum5d >= 3) momentumLabel = 'Strong Momentum'
          else if (momentum5d <= -3) momentumLabel = 'Weak Momentum'

          return {
            symbol,
            name: quote?.name || symbol,
            momentum_5d: momentum5d,
            price: last,
            change: quote.changePercent || 0,
            momentumLabel,
            rationale: `5-day momentum ${momentum5d.toFixed(2)}%.`,
          }
        } catch {
          return null
        }
      })
    )

    const filtered = stocks
      .filter((s): s is NonNullable<typeof s> => !!s && s.price > 0)
      .sort((a, b) => b.momentum_5d - a.momentum_5d)
      .slice(0, 10)

    return NextResponse.json({
      stocks: filtered,
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
