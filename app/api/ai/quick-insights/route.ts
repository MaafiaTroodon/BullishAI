import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'
import { safeJsonFetcher } from '@/lib/safeFetch'

export async function GET(req: NextRequest) {
  try {
    // Fetch market data
    const [spyRes, qqqRes, newsRes] = await Promise.all([
      fetch('https://api.twelvedata.com/quote?symbol=SPY&apikey=' + process.env.TWELVEDATA_API_KEY).catch(() => null),
      fetch('https://api.twelvedata.com/quote?symbol=QQQ&apikey=' + process.env.TWELVEDATA_API_KEY).catch(() => null),
      fetch(`${req.nextUrl.origin}/api/news?symbol=SPY`).catch(() => null),
    ])

    const spy = spyRes ? await spyRes.json().catch(() => null) : null
    const qqq = qqqRes ? await qqqRes.json().catch(() => null) : null
    const news = newsRes ? await newsRes.json().catch(() => null) : null

    // Get top movers
    const topMovers = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
      .then(r => r.json())
      .catch(() => ({ stocks: [] }))

    const context: RAGContext = {
      marketData: {
        session: 'REG',
        indices: {
          SPY: spy ? {
            value: parseFloat(spy.close || 0),
            change: parseFloat(spy.change || 0),
            changePercent: parseFloat(spy.percent_change || 0),
          } : undefined,
          QQQ: qqq ? {
            value: parseFloat(qqq.close || 0),
            change: parseFloat(qqq.change || 0),
            changePercent: parseFloat(qqq.percent_change || 0),
          } : undefined,
        },
      },
      news: news?.items?.slice(0, 5) || [],
    }

    const query = `Provide a one-paragraph market snapshot covering:
1. Overall market sentiment (bullish/bearish/neutral)
2. Key macro factors driving today's action
3. Top 3 tickers to watch with brief reasons (symbol, price change, catalyst)

Format as a concise paragraph with the 3 tickers listed at the end.`

    const systemPrompt = `You are a market analyst providing quick insights. Be concise, factual, and cite specific numbers from context.`

    const response = await routeAIQuery(query, context, systemPrompt)

    // Extract top 3 tickers from response or use top movers
    const topTickers = topMovers.stocks?.slice(0, 3).map((s: any) => ({
      symbol: s.symbol,
      name: s.name,
      change: s.changePercent || 0,
      reason: 'High volume and momentum',
    })) || []

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

