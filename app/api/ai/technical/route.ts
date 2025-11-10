import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol')?.toUpperCase() || 'AAPL'

    // Fetch quote and chart data
    const [quoteRes, chartRes] = await Promise.all([
      fetch(`${req.nextUrl.origin}/api/quote?symbol=${symbol}`),
      fetch(`${req.nextUrl.origin}/api/chart?symbol=${symbol}&range=1m`),
    ])

    const quote = await quoteRes.json().catch(() => null)
    const chart = await chartRes.json().catch(() => null)

    const context: RAGContext = {
      symbol,
      prices: quote ? {
        [symbol]: {
          price: parseFloat(quote.price || 0),
          change: parseFloat(quote.change || 0),
          changePercent: parseFloat(quote.changePercent || 0),
          timestamp: Date.now(),
        },
      } : undefined,
    }

    const query = `Provide technical analysis for ${symbol}:
1. Current trend (bullish/bearish/neutral)
2. Key support and resistance levels
3. Technical patterns identified
4. Momentum score (0-100)
5. Risk note

Format as JSON with fields: trend, supportLevel, resistanceLevel, patterns (array), momentumScore, riskNote`

    const jsonSchema = {
      type: 'object',
      properties: {
        trend: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
        supportLevel: { type: 'number' },
        resistanceLevel: { type: 'number' },
        patterns: { type: 'array', items: { type: 'string' } },
        momentumScore: { type: 'number', minimum: 0, maximum: 100 },
        riskNote: { type: 'string' },
      },
    }

    const response = await routeAIQuery(query, context, undefined, jsonSchema)

    let analysis
    try {
      analysis = JSON.parse(response.answer)
    } catch {
      analysis = {
        trend: 'neutral',
        supportLevel: parseFloat(quote?.price || 0) * 0.95,
        resistanceLevel: parseFloat(quote?.price || 0) * 1.05,
        patterns: ['No clear patterns identified'],
        momentumScore: 50,
        riskNote: 'Technical analysis is based on historical patterns and may not predict future movements.',
      }
    }

    return NextResponse.json({
      symbol,
      analysis,
      model: response.model,
      latency: response.latency,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Technical analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate technical analysis' },
      { status: 500 }
    )
  }
}

