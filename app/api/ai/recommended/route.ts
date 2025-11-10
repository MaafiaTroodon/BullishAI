import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const market = searchParams.get('market') || 'US'
    const sector = searchParams.get('sector') || 'all'

    // Fetch popular stocks and quotes
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    const symbols = popular.stocks?.slice(0, 20).map((s: any) => s.symbol).join(',') || 'AAPL,MSFT,GOOGL,AMZN,TSLA'
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))

    const context: RAGContext = {
      prices: {},
      news: [],
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
      stocks = quotes.quotes?.slice(0, 10).map((q: any) => ({
        symbol: q.symbol,
        price: parseFloat(q.price || 0),
        changePercent: parseFloat(q.changePercent || 0),
        reason: 'momentum',
        rationale: 'High trading volume and positive price action',
      })) || []
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

