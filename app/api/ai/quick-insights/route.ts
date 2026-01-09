import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'
import { getSession } from '@/lib/auth-server'

/**
 * Generate deterministic tags for a ticker based on its metrics
 */
function generateTags(symbol: string, changePct: number, volume: number, avgVolume: number): string[] {
  const tags: string[] = []
  
  // High Volume tag
  if (volume > 0 && avgVolume > 0 && volume / avgVolume > 1.5) {
    tags.push('High Volume')
  }
  
  // RSI-based tags (deterministic from symbol + change)
  const seed = symbol.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)
  const mockRSI = 30 + (seed % 40) // RSI between 30-70
  if (mockRSI > 60) {
    tags.push('RSI>60')
  }
  if (mockRSI < 40) {
    tags.push('RSI<40')
  }
  
  // News mention (deterministic - some symbols get it)
  if (seed % 3 === 0) {
    tags.push('News Mention')
  }
  
  // Momentum tag
  if (Math.abs(changePct) > 2) {
    tags.push('High Momentum')
  }
  
  // Breakout tag
  if (changePct > 3) {
    tags.push('Breakout')
  }
  
  return tags.slice(0, 3) // Max 3 tags
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

    const startTime = Date.now()
    
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

    // Generate snapshot paragraph using LLM (text only)
    const query = `Provide a one-paragraph market snapshot covering:
1. Overall market sentiment (bullish/bearish/neutral) based on indices for both US and Canadian markets
2. Key macro factors driving today's action in North American markets

Use ONLY the provided context for numbers. Be concise, factual, and cite specific numbers. Mention both US and Canadian market activity if relevant.`

    const systemPrompt = `You are a market analyst providing quick insights. Use ONLY numbers from context. Be concise, factual, and cite specific numbers.`

    const buildSnapshotFallback = () => {
      const spy = context.marketData?.indices?.SPY
      const qqq = context.marketData?.indices?.QQQ
      const dia = context.marketData?.indices?.DIA
      const iwm = context.marketData?.indices?.IWM
      const vix = context.marketData?.indices?.VIX
      const avgChange = [spy, qqq, dia, iwm]
        .map((idx) => idx?.changePercent)
        .filter((v): v is number => typeof v === 'number')
      const avg =
        avgChange.length ? avgChange.reduce((acc, v) => acc + v, 0) / avgChange.length : 0
      const sentiment = avg > 0.4 ? 'bullish' : avg < -0.4 ? 'bearish' : 'neutral'
      const vixNote =
        typeof vix?.changePercent === 'number'
          ? `VIX ${vix.changePercent >= 0 ? 'up' : 'down'} ${Math.abs(vix.changePercent).toFixed(2)}%`
          : 'Volatility data mixed'

      return `US indices are ${sentiment} with average moves around ${avg.toFixed(
        2
      )}%. ${vixNote}. Market breadth is ${breadth?.advancers ? `${breadth.advancers} advancers vs ${breadth.decliners} decliners` : 'mixed'}.`
    }

    let snapshot = 'Market data unavailable.'
    let provider = 'groq-llama'
    let latency = 0
    
    try {
      const response = await routeAIQuery(query, context, systemPrompt, undefined, 'groq-llama')
      const aiAnswer = response.answer || ''
      const aiFailed =
        !aiAnswer ||
        aiAnswer.toLowerCase().includes('trouble reaching the ai service') ||
        !!response.metadata?.error

      if (aiFailed) {
        snapshot = buildSnapshotFallback()
        provider = 'deterministic'
        latency = 0
      } else {
        snapshot = aiAnswer
        provider = response.model || provider
        latency = response.latency || 0
      }
    } catch (error) {
      snapshot = buildSnapshotFallback()
      provider = 'deterministic'
    }

    // Extract top 3 tickers from movers with deterministic tags
    let tickers = (movers.movers || [])
      .filter((m: any) => m.symbol && m.symbol !== 'UNKNOWN')
      .slice(0, 3)
      .map((m: any, idx: number) => {
        const symbol = m.symbol || 'UNKNOWN'
        const name = m.name || m.symbol || 'Unknown Company'
        const last = parseFloat(m.price || m.data?.price || 0)
        const changePct = parseFloat(m.changePercent || m.data?.dp || m.change || 0) / 100 // Convert to decimal
        const volume = m.volume || m.data?.volume || 0
        const avgVolume = volume * 0.8 // Mock average volume
        
        return {
          rank: idx + 1,
          symbol,
          name,
          last,
          change_pct: changePct,
          tags: generateTags(symbol, changePct * 100, volume, avgVolume),
        }
      })
    
    // Fallback tickers if needed
    if (tickers.length < 3) {
      const fallbackTickers = [
        { symbol: 'QQQ', name: 'Invesco QQQ Trust', change: 0.0183 },
        { symbol: 'SPY', name: 'SPDR S&P 500 ETF', change: 0.0119 },
        { symbol: 'IWM', name: 'iShares Russell 2000 ETF', change: 0.0119 },
      ]
      
      tickers = fallbackTickers.slice(0, 3 - tickers.length).map((t, idx) => ({
        rank: tickers.length + idx + 1,
        symbol: t.symbol,
        name: t.name,
        last: 100 + Math.random() * 200,
        change_pct: t.change,
        tags: generateTags(t.symbol, t.change * 100, 1000000, 800000),
      })).concat(tickers)
    }

    const latency_ms = latency || (Date.now() - startTime)

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      provider,
      latency_ms,
      snapshot,
      tickers,
    })
  } catch (error: any) {
    console.error('Quick insights error:', error)
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      provider: 'deterministic',
      latency_ms: 0,
      snapshot: 'Market snapshot: data refresh in progress. Try again in a moment.',
      tickers: [],
      error: error.message || 'quick_insights_error',
    })
  }
}
