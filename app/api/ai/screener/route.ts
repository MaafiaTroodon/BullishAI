import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'value-quality'
    const market = searchParams.get('market') || 'US'
    const sector = searchParams.get('sector') || 'all'

    // Fetch popular stocks
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    const symbols = popular.stocks?.slice(0, 50).map((s: any) => s.symbol).join(',') || 'AAPL,MSFT,GOOGL,AMZN,TSLA,META,NVDA'
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))

    const context: RAGContext = {
      prices: {},
    }

    quotes.quotes?.forEach((q: any) => {
      if (q.symbol && q.price) {
        context.prices![q.symbol] = {
          price: parseFloat(q.price) || 0,
          change: parseFloat(q.change || 0),
          changePercent: parseFloat(q.changePercent || 0),
          timestamp: Date.now(),
        }
      }
    })

    const queries: Record<string, string> = {
      'value-quality': 'Which high-quality stocks offer the best value this week? Screen for value metrics (P/E, P/B) combined with quality factors (ROE, earnings growth). Return top 5-10 stocks.',
      'momentum': 'Which five stocks have the strongest short-term momentum? Screen for price momentum, volume trends, and recent breakouts. Return top 5.',
      'undervalued': 'Which undervalued stocks are poised for a rebound? Screen for oversold conditions, mean reversion signals, and fundamental value. Return top 5-10 stocks.',
      'strongest': 'Which stocks are the strongest and most worth watching today? Screen for relative strength, volume leaders, and positive price action. Return top 5-10.',
      'stable-growth': 'Which stocks are stable growth picks suitable for long-term holding? Screen for low beta, consistent EPS growth, and dividend history. Return top 5-10.',
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
      // Fallback: use top movers
      stocks = quotes.quotes?.slice(0, 10).map((q: any) => ({
        symbol: q.symbol,
        price: parseFloat(q.price || 0),
        changePercent: parseFloat(q.changePercent || 0),
        rationale: 'Screened based on market data',
        metrics: {},
      })) || []
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

