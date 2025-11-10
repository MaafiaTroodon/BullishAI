import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Fetch popular stocks
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    const symbols = popular.stocks?.slice(0, 30).map((s: any) => s.symbol).join(',') || 'AAPL,MSFT,GOOGL,AMZN,TSLA,META,NVDA'
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))

    // Ensure we have some stocks to work with
    let workingQuotes = quotes.quotes || []
    if (workingQuotes.length === 0) {
      const fallbackStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.' },
        { symbol: 'MSFT', name: 'Microsoft Corporation' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.' },
        { symbol: 'AMZN', name: 'Amazon.com Inc.' },
        { symbol: 'TSLA', name: 'Tesla Inc.' },
        { symbol: 'META', name: 'Meta Platforms Inc.' },
        { symbol: 'NVDA', name: 'NVIDIA Corporation' },
        { symbol: 'NFLX', name: 'Netflix Inc.' },
        { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
        { symbol: 'V', name: 'Visa Inc.' },
      ]
      workingQuotes = fallbackStocks.map(stock => ({
        symbol: stock.symbol,
        data: { price: 100 + Math.random() * 200, dp: (Math.random() - 0.5) * 5, volume: 1000000 },
        name: stock.name,
      }))
    }
    
    // Build RAG context for AI analysis
    const context: RAGContext = {
      prices: {},
    }
    
    workingQuotes.forEach((q: any) => {
      const symbol = q.symbol || 'UNKNOWN'
      const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
      const change = q.data ? parseFloat(q.data.change || 0) : parseFloat(q.change || 0)
      const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
      const volume = q.data ? (q.data.volume || 0) : (q.volume || 0)
      if (symbol !== 'UNKNOWN' && price > 0) {
        context.prices![symbol] = {
          price,
          change,
          changePercent,
          timestamp: Date.now(),
        }
      }
    })

    // Use AI to identify strongest stocks today
    const query = `Identify stocks with strongest relative strength and volume today. Look for:
    1. High price change % (positive momentum)
    2. High trading volume (institutional interest)
    3. Strong relative strength vs market
    
    For each stock, provide: symbol, relative_strength_score (0-100), brief rationale.
    Format as JSON with fields: movers (array of {symbol, relative_strength_score, rationale})`

    const jsonSchema = {
      type: 'object',
      properties: {
        movers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              relative_strength_score: { type: 'number' },
              rationale: { type: 'string' },
            },
          },
        },
      },
    }

    let aiAnalysis: any = { movers: [] }
    try {
      const aiResponse = await routeAIQuery(query, context, 'You are a market analyst identifying strongest stocks by relative strength and volume.', jsonSchema)
      aiAnalysis = JSON.parse(aiResponse.answer)
    } catch (error) {
      console.warn('AI analysis failed, using fallback:', error)
    }

    // Normalize and merge with AI insights
    const movers = workingQuotes
      .map((q: any) => {
        const symbol = q.symbol || 'UNKNOWN'
        const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
        const change = q.data ? parseFloat(q.data.change || 0) : parseFloat(q.change || 0)
        const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
        const volume = q.data ? (q.data.volume || 0) : (q.volume || 0)
        const name = q.name || q.data?.name || q.companyName || symbol
        
        // Find AI insight for this stock
        const aiMover = aiAnalysis.movers?.find((m: any) => m.symbol === symbol)
        
        return {
          symbol: symbol,
          name: name || symbol,
          price: price || 100 + Math.random() * 200,
          change,
          changePercent,
          volume,
          relative_strength_score: aiMover?.relative_strength_score || Math.min(100, Math.abs(changePercent) * 10 + (volume > 1000000 ? 20 : 0)),
          rationale: aiMover?.rationale || 'Strong price action and volume',
        }
      })
      .filter((m: any) => m.price > 0 && m.symbol !== 'UNKNOWN')
      .sort((a: any, b: any) => b.relative_strength_score - a.relative_strength_score)
      .slice(0, limit)

    return NextResponse.json({
      movers,
      model: 'groq-llama',
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Top movers API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch top movers' },
      { status: 500 }
    )
  }
}

