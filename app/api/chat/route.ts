import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'
import { searchKnowledgeBase, detectSection, extractTickers, loadKnowledgeBase } from '@/lib/chat-knowledge-base'
import { calculateTechnical } from '@/lib/technical-calculator'

/**
 * Conversational Chat API - Main entry point for chat interface
 * Uses stock_qa_100k.json as knowledge base
 * Routes to appropriate models (Groq/Gemini for text, PyTorch for numbers)
 */
export async function POST(req: NextRequest) {
  try {
    const { query, symbol } = await req.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // 1. Search knowledge base for relevant context
    const relevantContext = await searchKnowledgeBase(query, 5)
    
    // 2. Detect section/intent
    const section = detectSection(query)
    const tickers = extractTickers(query) || (symbol ? [symbol.toUpperCase()] : [])

    // 3. Fetch real-time market data based on query intent
    const context: RAGContext = {
      symbol: symbol || tickers[0] || undefined,
      prices: {},
      marketData: {
        session: 'REG',
        indices: {},
      },
      news: [],
    }

    // Fetch market indices for quick insights
    if (section === 'Quick Insights' || query.toLowerCase().includes('market') || query.toLowerCase().includes('index')) {
      try {
        const indicesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=SPY,QQQ,DIA,IWM,VIX`)
        const indices = await indicesRes.json().catch(() => ({ quotes: [] }))
        
        indices.quotes?.forEach((q: any) => {
          const sym = q.symbol
          const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
          const change = q.data ? parseFloat(q.data.change || 0) : parseFloat(q.change || 0)
          const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
          
          if (sym && price > 0) {
            context.prices![sym] = {
              price,
              change,
              changePercent,
              timestamp: Date.now(),
            }
            context.marketData!.indices[sym] = {
              value: price,
              change,
              changePercent,
            }
          }
        })
      } catch (error) {
        console.error('Failed to fetch indices:', error)
      }
    }

    // Fetch quotes for detected tickers
    if (tickers.length > 0) {
      try {
        const symbols = tickers.join(',')
        const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
        const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))
        
        quotes.quotes?.forEach((q: any) => {
          const sym = q.symbol
          const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
          const change = q.data ? parseFloat(q.data.change || 0) : parseFloat(q.change || 0)
          const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
          
          if (sym && price > 0) {
            context.prices![sym] = {
              price,
              change,
              changePercent,
              timestamp: Date.now(),
            }
          }
        })
      } catch (error) {
        console.error('Failed to fetch quotes:', error)
      }
    }

    // Fetch news for news-related queries
    if (query.toLowerCase().includes('news') || query.toLowerCase().includes('headline') || section === 'Quick Insights') {
      try {
        const newsRes = await fetch(`${req.nextUrl.origin}/api/news/movers?limit=10`)
        const news = await newsRes.json().catch(() => ({ items: [] }))
        context.news = news.items || []
      } catch (error) {
        console.error('Failed to fetch news:', error)
      }
    }

    // 4. Build conversational prompt with knowledge base context
    const kbContext = relevantContext
      .map(ctx => `Q: ${ctx.question}\nA: ${ctx.answer}`)
      .join('\n\n')

    const systemPrompt = `You are BullishAI — a conversational market analyst who chats casually about stocks, trends, and insights. 
You're friendly, confident, and human-like. Avoid robotic tables or bullet-point spam unless explicitly asked.

${kbContext ? `\nRelevant context from knowledge base:\n${kbContext}\n` : ''}

Guidelines:
- Keep answers concise (1-3 sentences typically)
- Use natural, conversational language
- Add emojis sparingly for friendliness
- Always end with a conversational follow-up question
- Never show error JSON or technical details to users
- If you don't have data, say so naturally: "I don't have that info right now, but I can check [alternative]"
- Include disclaimers naturally: "Not financial advice, but..." or "Just my take, not a recommendation"

Tone: Chatty, confident, helpful, not robotic.`

    const fullQuery = `${query}${section ? ` (Context: ${section})` : ''}`

    // 5. Route to appropriate model
    let response
    try {
      response = await routeAIQuery(fullQuery, context, systemPrompt)
    } catch (error: any) {
      // Handle rate limits gracefully
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        // Fallback to cached response or simpler model
        const fallbackAnswer = relevantContext.length > 0
          ? relevantContext[0].answer
          : "Looks like I hit my request limit — but here's a quick summary from cached data. The market's been active today. Want me to check specific tickers when I'm back online?"
        
        return NextResponse.json({
          answer: fallbackAnswer,
          model: 'fallback-cached',
          latency: 0,
          cached: true,
        })
      }
      throw error
    }

    // 6. Format response naturally
    let answer = response.answer || "I'm not sure how to answer that right now. Can you rephrase?"
    
    // Add follow-up question if not present
    if (!answer.includes('?') && !answer.match(/want|should|need|can/i)) {
      const followUps = [
        "Want me to dig deeper into any specific tickers?",
        "Should I pull the latest numbers?",
        "Want me to check the RSI levels too?",
        "Need more details on that?",
      ]
      answer += ` ${followUps[Math.floor(Math.random() * followUps.length)]}`
    }

    // Add model badge info (will be displayed in UI)
    const modelBadge = response.model === 'groq-llama' ? 'Groq Live' : 
                      response.model === 'gemini' ? 'Gemini AI' : 
                      response.model || 'AI'

    return NextResponse.json({
      answer,
      model: response.model,
      modelBadge,
      latency: response.latency,
      section: section || undefined,
      tickers: tickers.length > 0 ? tickers : undefined,
    })
  } catch (error: any) {
    console.error('Chat API error:', error)
    
    // Never show raw errors to users
    return NextResponse.json({
      answer: "Sorry, I'm having a bit of trouble right now. Can you try rephrasing that? Or ask me about something else — I'm great with stock prices, market trends, and quick insights!",
      model: 'error-fallback',
      latency: 0,
    })
  }
}

