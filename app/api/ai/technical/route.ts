import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'
import { calculateTechnical } from '@/lib/technical-calculator'

export async function GET(req: NextRequest) {
  try {
    const startTime = Date.now()
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol')?.toUpperCase() || 'AAPL'

    // Fetch quote, OHLC, and chart data
    const [quoteRes, ohlcRes] = await Promise.all([
      fetch(`${req.nextUrl.origin}/api/quote?symbol=${symbol}`).catch(() => null),
      fetch(`${req.nextUrl.origin}/api/ohlc?symbol=${symbol}&tf=1d`).catch(() => null),
    ])

    const quote = quoteRes ? await quoteRes.json().catch(() => null) : null
    const ohlc = ohlcRes ? await ohlcRes.json().catch(() => null) : null

    const currentPrice = parseFloat(quote?.price || 0)

    // Calculate technical indicators deterministically (no LLM for numbers)
    const ohlcData = ohlc?.candles || []
    const calc = calculateTechnical(
      ohlcData.map((c: any) => ({
        open: parseFloat(c.open || 0),
        high: parseFloat(c.high || 0),
        low: parseFloat(c.low || 0),
        close: parseFloat(c.close || 0),
        volume: parseFloat(c.volume || 0),
      })),
      currentPrice
    )

    // Generate text explanations using LLM (text only)
    const context: RAGContext = {
      symbol,
      prices: quote ? {
        [symbol]: {
          price: currentPrice,
          change: parseFloat(quote.change || 0),
          changePercent: parseFloat(quote.changePercent || 0),
          timestamp: Date.now(),
        },
      } : undefined,
    }

    const query = `Provide a brief technical analysis explanation for ${symbol}:
1. Investment thesis (2 short sentences about the technical setup)
2. Risk note (1 short sentence about key risks)

Use ONLY the provided context for numbers. Be concise and factual.`

    let thesis = 'Technical analysis based on current market data.'
    let risk = 'Past performance does not guarantee future results.'
    let provider = 'groq-llama'
    let latency = 0

    try {
      const response = await routeAIQuery(query, context)
      // Try to parse thesis and risk from response
      const answer = response.answer || ''
      const lines = answer.split('\n').filter(l => l.trim())
      if (lines.length >= 2) {
        thesis = lines[0].trim()
        risk = lines[1].trim()
      } else if (lines.length === 1) {
        thesis = lines[0].trim()
      }
      provider = response.model || provider
      latency = response.latency || 0
    } catch (error) {
      // Fallback explanations if LLM fails
      thesis = `Technical analysis for ${symbol} based on current market data.`
      risk = 'Past performance does not guarantee future results.'
    }

    const latency_ms = latency || (Date.now() - startTime)

    return NextResponse.json({
      symbol,
      provider,
      latency_ms,
      calc: {
        trend: calc.trend,
        support: calc.support,
        resistance: calc.resistance,
        momentum_score: calc.momentum_score,
        patterns: calc.patterns,
      },
      explain: {
        thesis,
        risk,
      },
      meta: {
        as_of: new Date().toISOString(),
        lookback_days: 60,
      },
    })
  } catch (error: any) {
    console.error('Technical analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate technical analysis' },
      { status: 500 }
    )
  }
}

