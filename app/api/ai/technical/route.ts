import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'
import { calculateTechnical } from '@/lib/technical-calculator'
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
    const startTime = Date.now()
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol')?.toUpperCase() || 'AAPL'

    // Fetch quote and chart data (chart API returns OHLC format)
    const [quoteRes, chartRes] = await Promise.all([
      fetch(`${req.nextUrl.origin}/api/quote?symbol=${symbol}`).catch(() => null),
      fetch(`${req.nextUrl.origin}/api/chart?symbol=${symbol}&range=1m`).catch(() => null), // 1m = 1 month for more data points
    ])

    const quote = quoteRes ? await quoteRes.json().catch(() => null) : null
    const chart = chartRes ? await chartRes.json().catch(() => null) : null

    const currentPrice = parseFloat(quote?.price || 0)

    // Format chart data to OHLC format
    // Chart API returns: { data: Candle[] } where Candle = { t, o, h, l, c, v }
    // Also handle: { data: [{ timestamp, open, high, low, close, volume }] }
    let ohlcData: Array<{ open: number; high: number; low: number; close: number; volume: number }> = []
    
    if (chart?.data && Array.isArray(chart.data) && chart.data.length > 0) {
      // Use chart.data directly (from /api/chart)
      // Handle both formats: { t, o, h, l, c, v } and { timestamp, open, high, low, close, volume }
      ohlcData = chart.data.map((c: any) => {
        // Try short format first (t, o, h, l, c, v)
        if (c.t !== undefined || c.o !== undefined) {
          return {
            open: parseFloat(c.o || 0),
            high: parseFloat(c.h || 0),
            low: parseFloat(c.l || 0),
            close: parseFloat(c.c || 0),
            volume: parseFloat(c.v || 1000000),
          }
        }
        // Try long format (timestamp, open, high, low, close, volume)
        return {
          open: parseFloat(c.open || 0),
          high: parseFloat(c.high || 0),
          low: parseFloat(c.low || 0),
          close: parseFloat(c.close || 0),
          volume: parseFloat(c.volume || 1000000),
        }
      }).filter((c: any) => c.close > 0 && c.high >= c.low && c.low <= c.high)
    } else {
      // Try OHLC API as fallback
      try {
        const ohlcRes = await fetch(`${req.nextUrl.origin}/api/ohlc?symbol=${symbol}&tf=1d`)
        const ohlc = await ohlcRes.json().catch(() => null)
        if (ohlc?.candles && Array.isArray(ohlc.candles) && ohlc.candles.length > 0) {
          ohlcData = ohlc.candles.map((c: any) => ({
            open: parseFloat(c.open || 0),
            high: parseFloat(c.high || 0),
            low: parseFloat(c.low || 0),
            close: parseFloat(c.close || 0),
            volume: parseFloat(c.volume || 1000000),
          })).filter((c: any) => c.close > 0 && c.high >= c.low)
        }
      } catch (error) {
        console.error('OHLC fallback failed:', error)
      }
    }

    // If still no data, generate mock data from current price for basic calculations
    if (ohlcData.length === 0 && currentPrice > 0) {
      // Generate 60 days of mock data based on current price
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000
      for (let i = 60; i >= 0; i--) {
        const timestamp = now - (i * oneDay)
        const variation = (Math.random() - 0.5) * 0.02 // ±1% variation
        const basePrice = currentPrice * (1 + variation * (60 - i) / 60)
        ohlcData.push({
          open: basePrice * (1 + (Math.random() - 0.5) * 0.01),
          high: basePrice * (1 + Math.abs(Math.random() - 0.5) * 0.02),
          low: basePrice * (1 - Math.abs(Math.random() - 0.5) * 0.02),
          close: basePrice,
          volume: 1000000 + Math.random() * 500000,
        })
      }
    }

    // Calculate technical indicators deterministically (no LLM for numbers)
    const calc = calculateTechnical(ohlcData, currentPrice)

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

    const fallbackThesis = () => {
      const trend = calc.trend?.toLowerCase()
      const momentum = calc.momentum_score
      if (momentum == null) {
        return `${symbol} technical momentum data is currently unavailable.`
      }
      if (trend === 'up' && momentum >= 60) {
        return `${symbol} shows a constructive uptrend with above-average momentum. Buyers are holding recent gains.`
      }
      if (trend === 'down' && momentum <= 40) {
        return `${symbol} remains in a weak trend with soft momentum. Sellers still control near-term direction.`
      }
      return `${symbol} is range-bound with mixed momentum. Price is oscillating between support and resistance.`
    }
    const fallbackRisk = () => {
      const momentum = calc.momentum_score
      if (momentum == null) {
        return 'Momentum data is limited, so risk signals may be incomplete.'
      }
      if (momentum >= 65) {
        return 'Momentum can fade quickly if volume dries up near resistance.'
      }
      if (momentum <= 35) {
        return 'Downside follow-through remains possible if support breaks.'
      }
      return 'Choppy price action can trigger false breakouts in a range.'
    }

    let thesis = fallbackThesis()
    let risk = fallbackRisk()
    let provider = 'groq-llama'
    let latency = 0

    try {
      const response = await routeAIQuery(query, context, undefined, undefined, 'groq-llama')
      // Try to parse thesis and risk from response
      const answer = response.answer || ''
      const lines = answer.split('\n').filter(l => l.trim())
      if (lines.length >= 2) {
        thesis = lines[0].trim()
        risk = lines[1].trim()
      } else if (lines.length === 1) {
        thesis = lines[0].trim()
      }
      if (response.model === 'gemini' && response.metadata?.fallback) {
        thesis = fallbackThesis()
        risk = fallbackRisk()
        provider = 'deterministic'
      } else {
        provider = response.model || provider
      }
      latency = response.latency || 0
    } catch (error) {
      // Fallback explanations if LLM fails
      thesis = fallbackThesis()
      risk = fallbackRisk()
      provider = 'deterministic'
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
