import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'
import { getSession } from '@/lib/auth-server'

type OhlcPoint = {
  open?: number
  high?: number
  low?: number
  close?: number
  o?: number
  h?: number
  l?: number
  c?: number
}

function normalizeClose(point: OhlcPoint) {
  return point.close ?? point.c ?? 0
}

function normalizeHigh(point: OhlcPoint) {
  return point.high ?? point.h ?? 0
}

function normalizeLow(point: OhlcPoint) {
  return point.low ?? point.l ?? 0
}

function computeTrendPct(points: OhlcPoint[]) {
  if (!points.length) return 0
  const first = normalizeClose(points[0])
  const last = normalizeClose(points[points.length - 1])
  if (!first || !last) return 0
  return ((last - first) / first) * 100
}

function computeVolatilityPct(points: OhlcPoint[]) {
  if (!points.length) return 0
  const ranges = points
    .map((p) => {
      const high = normalizeHigh(p)
      const low = normalizeLow(p)
      const close = normalizeClose(p)
      if (!high || !low || !close) return null
      return ((high - low) / close) * 100
    })
    .filter((v): v is number => v !== null && Number.isFinite(v))
  if (!ranges.length) return 0
  const sum = ranges.reduce((acc, v) => acc + v, 0)
  return sum / ranges.length
}

function buildDeterministicAnalysis(params: {
  symbol: string
  price: number
  changePct: number
  trendPct: number
  volatilityPct: number
  peRatio?: number | null
  recentLow?: number
  recentHigh?: number
}) {
  const { symbol, price, changePct, trendPct, volatilityPct, peRatio, recentLow, recentHigh } = params
  const momentumStrong = trendPct >= 6 || changePct >= 2
  const momentumWeak = trendPct <= -6 || changePct <= -2
  const valuationRich = typeof peRatio === 'number' && peRatio > 35
  const valuationCheap = typeof peRatio === 'number' && peRatio > 0 && peRatio < 20
  const highVol = volatilityPct >= 3

  let verdict: 'Buy' | 'Hold' | 'Sell' = 'Hold'
  let confidence = 5

  if (momentumStrong && !valuationRich) {
    verdict = 'Buy'
    confidence = valuationCheap ? 8 : 7
  } else if (momentumWeak && valuationRich) {
    verdict = 'Sell'
    confidence = 7
  } else if (momentumWeak && highVol) {
    verdict = 'Sell'
    confidence = 6
  } else if (momentumStrong && valuationRich) {
    verdict = 'Hold'
    confidence = 6
  }

  const thesisParts = [
    `${symbol} is ${trendPct >= 0 ? 'up' : 'down'} ${Math.abs(trendPct).toFixed(1)}% over the recent lookback.`,
    `Volatility is ${highVol ? 'elevated' : 'moderate'} at ${volatilityPct.toFixed(2)}%.`,
  ]
  if (typeof peRatio === 'number') {
    thesisParts.push(`The P/E ratio is ${peRatio.toFixed(1)}.`)
  }

  const entry = recentLow
    ? `Consider entries near recent support around $${recentLow.toFixed(2)} and scale in if momentum stabilizes.`
    : `Consider entries on pullbacks while the trend remains ${trendPct >= 0 ? 'positive' : 'weak'}.`
  const exit = recentHigh
    ? `Consider exits near recent resistance around $${recentHigh.toFixed(2)} or tighten stops if momentum fades.`
    : `Use a trailing stop or reassess if price breaks recent lows.`

  const risks = [
    'Market-wide volatility can override stock-specific setups.',
    'Sector rotations may reduce near-term momentum.',
    highVol ? 'Elevated volatility can widen intraday swings.' : 'Lower volatility can limit immediate upside follow-through.',
  ]

  return {
    thesis: thesisParts.join(' '),
    entryConsiderations: entry,
    exitStrategy: exit,
    risks,
    verdict,
    confidence,
    disclaimer: 'This is NOT financial advice. Always do your own research and consult with a financial advisor.',
  }
}

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
    const symbol = searchParams.get('symbol')?.toUpperCase() || 'AAPL'

    // Fetch comprehensive data from live APIs
    const [quoteRes, newsRes, stockRes, chartRes] = await Promise.all([
      fetch(`${req.nextUrl.origin}/api/quote?symbol=${symbol}`).catch(() => null),
      fetch(`${req.nextUrl.origin}/api/news?symbol=${symbol}`).catch(() => null),
      fetch(`${req.nextUrl.origin}/api/stocks/${symbol}`).catch(() => null),
      fetch(`${req.nextUrl.origin}/api/chart?symbol=${symbol}&range=3m`).catch(() => null),
    ])

    const quote = quoteRes ? await quoteRes.json().catch(() => null) : null
    const news = newsRes ? await newsRes.json().catch(() => null) : null
    const stockData = stockRes ? await stockRes.json().catch(() => null) : null
    const chart = chartRes ? await chartRes.json().catch(() => null) : null

    const chartPoints = Array.isArray(chart?.data) ? chart.data : []
    const trendPct = computeTrendPct(chartPoints)
    const volatilityPct = computeVolatilityPct(chartPoints)
    const recentLows = chartPoints.slice(-20).map(normalizeLow).filter((v) => Number.isFinite(v) && v > 0)
    const recentHighs = chartPoints.slice(-20).map(normalizeHigh).filter((v) => Number.isFinite(v) && v > 0)
    const recentLow = recentLows.length ? Math.min(...recentLows) : undefined
    const recentHigh = recentHighs.length ? Math.max(...recentHighs) : undefined

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
      news: news?.items?.slice(0, 5) || [],
      fundamentals: stockData || undefined,
    }

    const query = `Provide a "Should I Buy?" analysis for ${symbol} (${symbol.includes('.TO') ? 'Canadian stock' : 'US stock'}):
1. Investment thesis (2-3 sentences) - consider market context (US vs Canadian market dynamics)
2. Entry considerations (price range, timing) - as a STRING, not an object
3. Exit strategy (target price, stop loss) - as a STRING, not an object
4. Key risks (3-4 points) - include currency risk if Canadian stock, sector-specific risks
5. Verdict: Buy/Hold/Sell with confidence level (1-10)

IMPORTANT: This is NOT financial advice. Include strong disclaimers.
Format as JSON with fields: thesis (string), entryConsiderations (string), exitStrategy (string), risks (array of strings), verdict (string), confidence (number), disclaimer (string)`

    const jsonSchema = {
      type: 'object',
      properties: {
        thesis: { type: 'string' },
        entryConsiderations: { type: 'string' },
        exitStrategy: { type: 'string' },
        risks: { type: 'array', items: { type: 'string' } },
        verdict: { type: 'string', enum: ['Buy', 'Hold', 'Sell'] },
        confidence: { type: 'number', minimum: 1, maximum: 10 },
        disclaimer: { type: 'string' },
      },
    }

    const systemPrompt = `You are a financial analyst providing investment analysis. 
ALWAYS include strong disclaimers that this is NOT financial advice.
Use ONLY numbers from context. Never guess prices or financial metrics.`

    const response = await routeAIQuery(query, context, systemPrompt, jsonSchema, 'groq-llama')

    let analysis
    try {
      analysis = JSON.parse(response.answer)
      // Ensure entryConsiderations and exitStrategy are strings
      if (typeof analysis.entryConsiderations !== 'string') {
        analysis.entryConsiderations = typeof analysis.entryConsiderations === 'object' 
          ? JSON.stringify(analysis.entryConsiderations) 
          : String(analysis.entryConsiderations || 'N/A')
      }
      if (typeof analysis.exitStrategy !== 'string') {
        analysis.exitStrategy = typeof analysis.exitStrategy === 'object' 
          ? JSON.stringify(analysis.exitStrategy) 
          : String(analysis.exitStrategy || 'N/A')
      }
    } catch {
      analysis = null
    }

    const peRatio = stockData?.quote?.peRatio ?? stockData?.fundamentals?.peRatio ?? null
    const usedFallback = response.model === 'gemini' && response.metadata?.fallback
    if (!analysis || usedFallback) {
      analysis = buildDeterministicAnalysis({
        symbol,
        price: parseFloat(quote?.price || 0),
        changePct: parseFloat(quote?.changePercent || 0),
        trendPct,
        volatilityPct: volatilityPct || Math.abs(parseFloat(quote?.changePercent || 0)),
        peRatio,
        recentLow,
        recentHigh,
      })
    }

    return NextResponse.json({
      symbol,
      analysis,
      model: usedFallback ? 'deterministic' : response.model,
      latency: response.latency,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Should I Buy error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate analysis' },
      { status: 500 }
    )
  }
}
