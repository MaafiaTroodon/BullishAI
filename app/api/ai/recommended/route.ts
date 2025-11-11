import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const market = searchParams.get('market') || 'US'
    const sector = searchParams.get('sector') || 'all'

    // Fetch top movers for real-time recommendations
    const [popularRes, moversRes] = await Promise.all([
      fetch(`${req.nextUrl.origin}/api/popular-stocks`).catch(() => null),
      fetch(`${req.nextUrl.origin}/api/market/top-movers?limit=20`).catch(() => null),
    ])

    const popular = popularRes ? await popularRes.json().catch(() => ({ stocks: [] })) : { stocks: [] }
    const movers = moversRes ? await moversRes.json().catch(() => ({ movers: [] })) : { movers: [] }

    // Use top movers if available, otherwise use popular stocks
    const stockList = movers.movers?.length > 0 
      ? movers.movers.map((m: any) => m.symbol).filter(Boolean)
      : popular.stocks?.slice(0, 20).map((s: any) => s.symbol).filter(Boolean) || ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'AMD']
    
    const symbols = stockList.join(',')
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))
    
    // Also fetch news for context
    const newsRes = await fetch(`${req.nextUrl.origin}/api/news/movers?limit=10`).catch(() => null)
    const news = newsRes ? await newsRes.json().catch(() => ({ items: [] })) : { items: [] }

    const context: RAGContext = {
      prices: {},
      news: news.items || [],
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

    const query = `Based on current market data, recommend 5-10 stocks with the following criteria:
1. Recent upgrades or positive analyst coverage
2. Technical breakouts (price breaking resistance)
3. Unusual volume activity
4. Strong fundamentals

For each stock, provide:
- Symbol
- Current price and change %
- Reason tag (upgrade/breakout/volume/fundamentals)
- Brief 1-sentence rationale

Format as JSON array with fields: symbol, price, changePercent, reason, rationale`

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
              reason: { type: 'string', enum: ['upgrade', 'breakout', 'volume', 'fundamentals'] },
              rationale: { type: 'string' },
            },
          },
        },
      },
    }

    const systemPrompt = `You are a stock screener providing recommendations. Use ONLY numbers from context. Never guess prices.`

    const response = await routeAIQuery(query, context, systemPrompt, jsonSchema)

    let stocks = []
    try {
      const parsed = JSON.parse(response.answer)
      stocks = parsed.stocks || []
    } catch {
      // Fallback: use top movers
      stocks = quotes.quotes?.slice(0, 10).map((q: any) => {
        const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
        const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
        const name = q.name || q.symbol
        
        return {
          symbol: q.symbol,
          name,
          price,
          changePercent,
          reason: 'momentum',
          rationale: 'High trading volume and positive price action',
        }
      }).filter((s: any) => s.price > 0) || []
    }

    return NextResponse.json({
      stocks,
      model: response.model,
      latency: response.latency,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Recommended stocks error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate recommendations' },
      { status: 500 }
    )
  }
}

