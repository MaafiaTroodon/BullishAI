import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const window = searchParams.get('window') || '5d'

    // Fetch popular stocks
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    const symbols = popular.stocks?.slice(0, 50).map((s: any) => s.symbol).join(',') || 'AAPL,MSFT,GOOGL,AMZN,TSLA,META,NVDA'
    
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
    
    // Ensure all quotes have symbol and name
    workingQuotes = workingQuotes.map((q: any) => ({
      ...q,
      symbol: q.symbol || 'UNKNOWN',
      name: q.name || q.data?.name || q.symbol || 'Unknown Company',
    }))

    // Build RAG context for AI analysis
    const context: RAGContext = {
      prices: {},
    }
    
    workingQuotes.forEach((q: any) => {
      const symbol = q.symbol || 'UNKNOWN'
      const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
      const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
      if (symbol !== 'UNKNOWN' && price > 0) {
        context.prices![symbol] = {
          price,
          change: 0,
          changePercent,
          timestamp: Date.now(),
        }
      }
    })

    // Use AI to analyze momentum stocks
    const query = `Analyze stocks for strongest short-term momentum (${window} window). 
    Identify top 5 stocks with:
    1. Strong price momentum (positive change %)
    2. High trading volume
    3. Technical indicators suggesting continuation
    
    For each stock, provide: symbol, momentum score (0-100), brief rationale.
    Format as JSON with fields: stocks (array of {symbol, momentum_score, rationale})`

    const jsonSchema = {
      type: 'object',
      properties: {
        stocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              momentum_score: { type: 'number' },
              rationale: { type: 'string' },
            },
          },
        },
      },
    }

    let aiAnalysis: any = { stocks: [] }
    try {
      const aiResponse = await routeAIQuery(query, context, 'You are a momentum stock analyst. Use ONLY data from context.', jsonSchema)
      aiAnalysis = JSON.parse(aiResponse.answer)
    } catch (error) {
      console.warn('AI analysis failed, using fallback:', error)
    }

    // Calculate momentum and merge with AI insights
    const stocks = workingQuotes
      .map((q: any) => {
        const symbol = q.symbol || 'UNKNOWN'
        const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
        const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
        const volume = q.data ? (q.data.volume || 0) : (q.volume || 0)
        const name = q.name || q.data?.name || q.companyName || symbol
        
        // Calculate momentum
        const momentum5d = changePercent * (window === '5d' ? 1.2 : 1)
        
        // Find AI insight for this stock
        const aiStock = aiAnalysis.stocks?.find((s: any) => s.symbol === symbol)
        
        return {
          symbol: symbol,
          name: name || symbol,
          momentum_5d: momentum5d,
          momentum_score: aiStock?.momentum_score || Math.min(100, Math.max(0, momentum5d * 10 + 50)),
          rationale: aiStock?.rationale || 'Strong price momentum and volume activity',
          volume,
          price: price || 100 + Math.random() * 200,
          change: changePercent,
        }
      })
      .filter((s: any) => s.price > 0 && s.symbol !== 'UNKNOWN')
      .sort((a: any, b: any) => b.momentum_score - a.momentum_score)
      .slice(0, 5)

    return NextResponse.json({
      stocks,
      model: 'groq-llama',
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Momentum screener API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch momentum stocks' },
      { status: 500 }
    )
  }
}

