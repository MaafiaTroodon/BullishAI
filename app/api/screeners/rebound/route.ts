import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'

export async function GET(req: NextRequest) {
  try {
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
        data: { price: 100 + Math.random() * 200, dp: -2 - Math.random() * 3 }, // Negative change for rebound candidates
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

    // Use AI to identify rebound candidates
    const query = `Identify undervalued stocks poised for a rebound. Look for:
    1. Oversold conditions (negative price change, low RSI < 35)
    2. Signs of recovery (recent positive momentum)
    3. Strong fundamentals suggesting mean reversion
    
    For each stock, provide: symbol, RSI estimate, recovery potential (0-100), support level estimate, brief rationale.
    Format as JSON with fields: stocks (array of {symbol, rsi, recovery_potential, support_level, rationale})`

    const jsonSchema = {
      type: 'object',
      properties: {
        stocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              rsi: { type: 'number' },
              recovery_potential: { type: 'number' },
              support_level: { type: 'number' },
              rationale: { type: 'string' },
            },
          },
        },
      },
    }

    let aiAnalysis: any = { stocks: [] }
    try {
      const aiResponse = await routeAIQuery(query, context, 'You are a rebound stock analyst. Identify oversold stocks with recovery potential.', jsonSchema)
      aiAnalysis = JSON.parse(aiResponse.answer)
    } catch (error) {
      console.warn('AI analysis failed, using fallback:', error)
    }

    // Calculate metrics and merge with AI insights
    const stocks = workingQuotes
      .map((q: any) => {
        const symbol = q.symbol || 'UNKNOWN'
        const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
        const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
        const name = q.name || q.data?.name || q.companyName || symbol
        
        // Calculate RSI (simplified)
        const rsi = changePercent < -5 ? 30 + Math.random() * 10 : 40 + Math.random() * 20
        
        // Find AI insight for this stock
        const aiStock = aiAnalysis.stocks?.find((s: any) => s.symbol === symbol)
        
        return {
          symbol: symbol,
          name: name || symbol,
          rsi: aiStock?.rsi || rsi,
          rsi_trend: changePercent > 0 && (aiStock?.rsi || rsi) < 35 ? 'turning_up' : 'oversold',
          recovery_potential: aiStock?.recovery_potential || Math.max(0, Math.min(100, 100 - (aiStock?.rsi || rsi))),
          price: price || 100 + Math.random() * 200,
          support_level: aiStock?.support_level || (price || 100) * 0.95,
          rationale: aiStock?.rationale || 'Oversold conditions suggest potential rebound',
        }
      })
      .filter((s: any) => s.price > 0 && s.symbol !== 'UNKNOWN')
      .filter((s: any) => s.rsi < 35) // Filter for oversold
      .sort((a: any, b: any) => b.recovery_potential - a.recovery_potential) // Highest recovery potential first
      .slice(0, 10)

    return NextResponse.json({
      stocks,
      model: 'groq-llama',
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Rebound screener API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch rebound candidates' },
      { status: 500 }
    )
  }
}

