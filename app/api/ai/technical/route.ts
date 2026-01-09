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
    const [quoteRes, chartRes, stockRes] = await Promise.all([
      fetch(`${req.nextUrl.origin}/api/quote?symbol=${symbol}`).catch(() => null),
      fetch(`${req.nextUrl.origin}/api/chart?symbol=${symbol}&range=1m`).catch(() => null), // 1m = 1 month for more data points
      fetch(`${req.nextUrl.origin}/api/stocks/${symbol}`).catch(() => null),
    ])

    const quote = quoteRes?.ok ? await quoteRes.json().catch(() => null) : null
    const chart = chartRes?.ok ? await chartRes.json().catch(() => null) : null
    const stock = stockRes?.ok ? await stockRes.json().catch(() => null) : null

    const toNumber = (value: any): number | null => {
      if (value === null || value === undefined) return null
      const num = Number(value)
      return Number.isFinite(num) ? num : null
    }

    const pickFirstNumber = (...values: Array<number | null | undefined>) => {
      for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value
        }
      }
      return null
    }

    let currentPrice = pickFirstNumber(
      toNumber(quote?.price),
      toNumber(stock?.quote?.price),
      null
    )

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
    if (ohlcData.length === 0 && currentPrice !== null && currentPrice > 0) {
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

    const lastClose = ohlcData.length ? ohlcData[ohlcData.length - 1].close : null
    const prevClose = ohlcData.length > 1 ? ohlcData[ohlcData.length - 2].close : null
    if ((currentPrice === null || currentPrice === 0) && lastClose) {
      currentPrice = lastClose
    }

    const derivedChange = lastClose && prevClose ? lastClose - prevClose : 0
    const derivedChangePct = lastClose && prevClose ? (derivedChange / prevClose) * 100 : null

    // Calculate technical indicators deterministically (no LLM for numbers)
    const calc = calculateTechnical(ohlcData, currentPrice || 0)

    // Generate text explanations using LLM (text only)
    const price = pickFirstNumber(
      toNumber(quote?.price),
      toNumber(stock?.quote?.price),
      toNumber(lastClose)
    )
    const change = pickFirstNumber(
      toNumber(quote?.change),
      toNumber(stock?.quote?.change),
      derivedChange
    )
    const changePercent = pickFirstNumber(
      toNumber(quote?.changePercent),
      toNumber(stock?.quote?.changePct),
      derivedChangePct
    )
    const marketCap = toNumber(stock?.quote?.marketCap)
    const week52High = toNumber(stock?.quote?.week52High)
    const week52Low = toNumber(stock?.quote?.week52Low)
    const volume = pickFirstNumber(
      toNumber(quote?.volume),
      toNumber(stock?.quote?.volume)
    )
    const displayChangePct = changePercent

    const context: RAGContext = {
      symbol,
      prices: price != null ? {
        [symbol]: {
          price,
          change: change ?? 0,
          changePercent: changePercent ?? 0,
          timestamp: Date.now(),
        },
      } : undefined,
      fundamentals: {
        marketCap,
        week52High,
        week52Low,
        volume,
      },
      news: Array.isArray(stock?.news) ? stock.news.slice(0, 3) : [],
    }

    const query = `Summarize ${symbol} with:
1) Current price & daily change
2) Trend + support/resistance from the technical data
3) 1-2 recent headlines (if provided)
4) Key facts if available (52w range, market cap, volume)
5) One short risk note

Use ONLY the provided context for numbers. Be concise and factual.`

    const fallbackThesis = () => {
      const changePct = displayChangePct
      const priceValue = price
      const trend = calc.trend?.toLowerCase()
      const momentum = calc.momentum_score
      if (!priceValue) {
        return `${symbol} price data is currently unavailable.`
      }
      const priceLine = `${symbol} is $${priceValue.toFixed(2)} (${changePct != null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '—'}).`
      const rangeLine = calc.support && calc.resistance
        ? `Support ~$${Number(calc.support).toFixed(2)}, resistance ~$${Number(calc.resistance).toFixed(2)}.`
        : 'Key levels are still forming.'
      const newsItems = (context.news || [])
        .map((item) => item.headline)
        .filter(Boolean)
        .slice(0, 2)
      const newsLine = newsItems.length
        ? `Headlines: ${newsItems.join(' | ')}.`
        : 'No major company-specific headline found today.'
      const facts: string[] = []
      if (context.fundamentals?.marketCap) {
        const cap = context.fundamentals.marketCap
        const capLabel = cap >= 1e12
          ? `${(cap / 1e12).toFixed(2)}T`
          : cap >= 1e9
            ? `${(cap / 1e9).toFixed(2)}B`
            : `${(cap / 1e6).toFixed(2)}M`
        facts.push(`Market cap ${capLabel}`)
      }
      if (context.fundamentals?.week52Low && context.fundamentals?.week52High) {
        facts.push(`52w range $${context.fundamentals.week52Low.toFixed(2)}–$${context.fundamentals.week52High.toFixed(2)}`)
      }
      if (context.fundamentals?.volume) {
        facts.push(`Vol ${Math.round(context.fundamentals.volume).toLocaleString()}`)
      }
      const factsLine = facts.length ? `Facts: ${facts.join(', ')}.` : ''

      if (trend === 'up' && momentum != null && momentum >= 60) {
        return `${priceLine} Trend remains constructive with above-average momentum. ${rangeLine} ${factsLine} ${newsLine}`.trim()
      }
      if (trend === 'down' && momentum != null && momentum <= 40) {
        return `${priceLine} Trend is weak with soft momentum. ${rangeLine} ${factsLine} ${newsLine}`.trim()
      }
      return `${priceLine} Range-bound setup with mixed momentum. ${rangeLine} ${factsLine} ${newsLine}`.trim()
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
      const answer = response.answer || ''
      const aiFailed =
        !answer ||
        answer.toLowerCase().includes('trouble reaching the ai service') ||
        !!response.metadata?.error

      if (aiFailed || (response.model === 'gemini' && response.metadata?.fallback)) {
        thesis = fallbackThesis()
        risk = fallbackRisk()
        provider = 'deterministic'
        latency = 0
      } else {
        const lines = answer.split('\n').filter(l => l.trim())
        if (lines.length >= 2) {
          thesis = lines[0].trim()
          risk = lines[1].trim()
        } else if (lines.length === 1) {
          thesis = lines[0].trim()
        }
        provider = response.model || provider
        latency = response.latency || 0
      }
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
