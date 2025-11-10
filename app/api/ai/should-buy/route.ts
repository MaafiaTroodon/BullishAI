import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol')?.toUpperCase() || 'AAPL'

    // Fetch comprehensive data
    const [quoteRes, newsRes, financialsRes] = await Promise.all([
      fetch(`${req.nextUrl.origin}/api/quote?symbol=${symbol}`),
      fetch(`${req.nextUrl.origin}/api/news?symbol=${symbol}`),
      fetch(`${req.nextUrl.origin}/api/stocks?symbol=${symbol}`).catch(() => null),
    ])

    const quote = await quoteRes.json().catch(() => null)
    const news = await newsRes.json().catch(() => null)
    const financials = financialsRes ? await financialsRes.json().catch(() => null) : null

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
      fundamentals: financials || undefined,
    }

    const query = `Provide a "Should I Buy?" analysis for ${symbol}:
1. Investment thesis (2-3 sentences)
2. Entry considerations (price range, timing)
3. Exit strategy (target price, stop loss)
4. Key risks (3-4 points)
5. Verdict: Buy/Hold/Sell with confidence level (1-10)

IMPORTANT: This is NOT financial advice. Include strong disclaimers.
Format as JSON with fields: thesis, entryConsiderations, exitStrategy, risks (array), verdict, confidence, disclaimer`

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

    const response = await routeAIQuery(query, context, systemPrompt, jsonSchema)

    let analysis
    try {
      analysis = JSON.parse(response.answer)
    } catch {
      analysis = {
        thesis: 'Analysis unavailable. Please consult with a financial advisor.',
        entryConsiderations: 'N/A',
        exitStrategy: 'N/A',
        risks: ['Market risk', 'Company-specific risk', 'Sector risk'],
        verdict: 'Hold',
        confidence: 5,
        disclaimer: 'This is NOT financial advice. Always do your own research and consult with a financial advisor.',
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
    console.error('Should I Buy error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate analysis' },
      { status: 500 }
    )
  }
}

