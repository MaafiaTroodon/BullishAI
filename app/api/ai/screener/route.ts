import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'
import { getSession } from '@/lib/auth-server'

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to use AI features.' },
        { status: 401 }
      )
    }
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'value-quality'
    const market = searchParams.get('market') || 'US'
    const sector = searchParams.get('sector') || 'all'

    // Fetch top movers and popular stocks for real-time screening
    const [popularRes, moversRes] = await Promise.all([
      fetch(`${req.nextUrl.origin}/api/popular-stocks`).catch(() => null),
      fetch(`${req.nextUrl.origin}/api/market/top-movers?limit=50`).catch(() => null),
    ])

    const popular = popularRes ? await popularRes.json().catch(() => ({ stocks: [] })) : { stocks: [] }
    const movers = moversRes ? await moversRes.json().catch(() => ({ movers: [] })) : { movers: [] }

    // Use top movers if available, otherwise use popular stocks (include Canadian stocks)
    const defaultStocks = [
      // US stocks
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'AMD', 'INTC', 'NFLX',
      // Canadian stocks
      'RY.TO', 'TD.TO', 'BNS.TO', 'BMO.TO', 'CM.TO', 'SHOP.TO', 'CNQ.TO', 'ENB.TO', 'TRP.TO', 'BAM.TO', 'CP.TO', 'CNR.TO', 'ATD.TO', 'SU.TO', 'WCN.TO'
    ]
    const stockList = movers.movers?.length > 0 
      ? movers.movers.map((m: any) => m.symbol).filter(Boolean)
      : popular.stocks?.slice(0, 50).map((s: any) => s.symbol).filter(Boolean) || defaultStocks
    
    const symbols = stockList.join(',')
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))

    const context: RAGContext = {
      prices: {},
      marketData: {
        session: 'REG',
        indices: {},
      },
    }

    quotes.quotes?.forEach((q: any) => {
      // Handle both formats: { symbol, data: {...} } and { symbol, price, ... }
      const symbol = q.symbol
      const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
      const change = q.data ? parseFloat(q.data.change || 0) : parseFloat(q.change || 0)
      const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
      
      if (symbol && price > 0) {
        context.prices![symbol] = {
          price,
          change,
          changePercent,
          timestamp: Date.now(),
        }
      }
    })

    const queries: Record<string, string> = {
      'value-quality': 'Which high-quality stocks (US and Canadian) offer the best value this week? Screen for value metrics (P/E, P/B) combined with quality factors (ROE, earnings growth). Include both US stocks (AAPL, MSFT, etc.) and Canadian stocks (RY.TO, TD.TO, SHOP.TO, CNQ.TO, ENB.TO, etc.). Return top 5-10 stocks in JSON format with a mix of both markets.',
      'momentum': 'Which five stocks (US and Canadian) have the strongest short-term momentum? Screen for price momentum, volume trends, and recent breakouts. Include both US stocks and Canadian stocks (RY.TO, TD.TO, SHOP.TO, etc.). Return top 5 in JSON format.',
      'undervalued': 'Which undervalued stocks (US and Canadian) are poised for a rebound? Screen for oversold conditions, mean reversion signals, and fundamental value. Include both US stocks and Canadian stocks (RY.TO, TD.TO, CNQ.TO, ENB.TO, etc.). Return top 5-10 stocks in JSON format.',
      'strongest': 'Which stocks (US and Canadian) are the strongest and most worth watching today? Screen for relative strength, volume leaders, and positive price action. Include both US stocks and Canadian stocks (RY.TO, TD.TO, SHOP.TO, BAM.TO, etc.). Return top 5-10 in JSON format.',
      'stable-growth': 'Which stocks (US and Canadian) are stable growth picks suitable for long-term holding? Screen for low beta, consistent EPS growth, and dividend history. Include both US stocks and Canadian stocks (RY.TO, TD.TO, ENB.TO, TRP.TO, CP.TO, CNR.TO, etc.). Return top 5-10 in JSON format.',
    }

    const query = queries[type] || queries['value-quality']

    const jsonSchema = {
      type: 'object',
      properties: {
        stocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              price: { type: 'number' },
              changePercent: { type: 'number' },
              rationale: { type: 'string' },
              metrics: { type: 'object' },
            },
          },
        },
        screenType: { type: 'string' },
      },
    }

    const response = await routeAIQuery(query, context, undefined, jsonSchema)

    let stocks = []
    try {
      const parsed = JSON.parse(response.answer)
      stocks = parsed.stocks || []
    } catch {
      // Fallback: use top movers with proper data format
      stocks = quotes.quotes?.slice(0, 10).map((q: any) => {
        const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
        const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
        
        return {
          symbol: q.symbol,
          price,
          changePercent,
          rationale: 'Screened based on current market data',
          metrics: {},
        }
      }).filter((s: any) => s.price > 0) || []
    }

    return NextResponse.json({
      type,
      stocks,
      model: response.model,
      latency: response.latency,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Screener error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to run screener' },
      { status: 500 }
    )
  }
}

