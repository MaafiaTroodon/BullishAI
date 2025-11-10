import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'

export async function GET(req: NextRequest) {
  try {
    // Fetch market data using internal APIs
    const [quotesRes, breadthRes, newsRes, moversRes] = await Promise.all([
      fetch(`${req.nextUrl.origin}/api/quotes?symbols=SPY,QQQ,DIA,IWM,VIX,DXY`).catch(() => null),
      fetch(`${req.nextUrl.origin}/api/market/breadth`).catch(() => null),
      fetch(`${req.nextUrl.origin}/api/news/movers?limit=5`).catch(() => null),
      fetch(`${req.nextUrl.origin}/api/market/top-movers?limit=10`).catch(() => null),
    ])

    const quotes = quotesRes ? await quotesRes.json().catch(() => ({ quotes: [] })) : { quotes: [] }
    const breadth = breadthRes ? await breadthRes.json().catch(() => ({})) : {}
    const news = newsRes ? await newsRes.json().catch(() => ({ items: [] })) : { items: [] }
    const movers = moversRes ? await moversRes.json().catch(() => ({ movers: [] })) : { movers: [] }

    // Normalize quotes format
    const normalizedQuotes = quotes.quotes.map((q: any) => {
      if (q.data) {
        return {
          symbol: q.symbol,
          price: q.data.price || 0,
          change: q.data.change || 0,
          changePercent: q.data.dp || 0,
        }
      }
      return q
    })

    const context: RAGContext = {
      prices: {},
      marketData: {
        session: 'REG',
        indices: {},
      },
      news: news.items || [],
    }

    // Build prices and indices
    normalizedQuotes.forEach((q: any) => {
      context.prices![q.symbol] = {
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        timestamp: Date.now(),
      }
      if (['SPY', 'QQQ', 'DIA', 'IWM', 'VIX', 'DXY'].includes(q.symbol)) {
        context.marketData!.indices[q.symbol] = {
          value: q.price,
          change: q.change,
          changePercent: q.changePercent,
        }
      }
    })

    const query = `Provide a one-paragraph market snapshot covering:
1. Overall market sentiment (bullish/bearish/neutral) based on indices
2. Key macro factors driving today's action
3. Top 3 tickers to watch with brief reasons (symbol, price change %, catalyst)

Use ONLY the provided context for numbers. Format as a concise paragraph with the 3 tickers listed at the end.`

    const systemPrompt = `You are a market analyst providing quick insights. Use ONLY numbers from context. Be concise, factual, and cite specific numbers.`

    const response = await routeAIQuery(query, context, systemPrompt)

            // Extract top 3 tickers from movers - ensure they have proper names
            const topTickers = (movers.movers || []).slice(0, 3).map((m: any) => ({
              symbol: m.symbol || 'UNKNOWN',
              name: m.name || m.symbol || 'Unknown Company',
              change: m.changePercent || 0,
              reason: m.reason || 'High volume and momentum',
            })).filter((t: any) => t.symbol !== 'UNKNOWN') || []
            
            // If we don't have enough tickers, use fallback
            if (topTickers.length < 3) {
              const fallbackTickers = [
                { symbol: 'QQQ', name: 'Invesco QQQ Trust', change: 1.83, reason: 'Strong momentum' },
                { symbol: 'SPY', name: 'SPDR S&P 500 ETF', change: 1.19, reason: 'Broad market' },
                { symbol: 'IWM', name: 'iShares Russell 2000 ETF', change: 1.19, reason: 'Small-cap participation' },
              ]
              topTickers.push(...fallbackTickers.slice(0, 3 - topTickers.length))
            }

    return NextResponse.json({
      insight: response.answer,
      topTickers,
      model: response.model,
      latency: response.latency,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Quick insights error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate insights' },
      { status: 500 }
    )
  }
}

