import { NextRequest, NextResponse } from 'next/server'
import { routeAIQuery, RAGContext } from '@/lib/ai-router'
import { searchKnowledgeBase, detectSection, extractTickers, loadKnowledgeBase } from '@/lib/chat-knowledge-base'
import { findBestMatch, buildKnowledgePrompt, selectBestModel } from '@/lib/ai-knowledge-trainer'
import { calculateTechnical } from '@/lib/technical-calculator'
import { getSession } from '@/lib/auth-server'

/**
 * Conversational Chat API - Main entry point for chat interface
 * Uses stock_qa_100k.json as knowledge base
 * Routes to appropriate models (Groq/Gemini for text, PyTorch for numbers)
 */
export async function POST(req: NextRequest) {
  // Check authentication
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required. Please log in to use AI features.' },
      { status: 401 }
    )
  }

  let query = ''
  let symbol = ''
  
  try {
    const body = await req.json()
    query = body.query || ''
    symbol = body.symbol || ''

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // 1. Load and search knowledge base for best matches (always do this first)
    let kb: any[] = []
    let relevantContext: any[] = []
    
    try {
      kb = await loadKnowledgeBase()
      relevantContext = findBestMatch(query, kb, 5)
    } catch (kbError) {
      console.error('Failed to load knowledge base:', kbError)
      // Continue without KB, but will use empty array
    }
    
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

    // 4. If we have a knowledge base match, use it directly (faster, more reliable)
    // This ensures users always get answers even if AI is down
    if (relevantContext.length > 0) {
      const bestMatch = relevantContext[0]
      console.log('Found knowledge base match for query:', query, 'Answer:', bestMatch.answer.substring(0, 50))
      
      // Use KB answer directly (we'll enhance with AI if needed, but KB is reliable)
      let answer = bestMatch.answer
      
      // Enhance with real-time data if available
      if (Object.keys(context.prices || {}).length > 0) {
        const priceInfo = Object.entries(context.prices || {})
          .slice(0, 3)
          .map(([sym, data]: [string, any]) => `${sym}: $${data.price.toFixed(2)} (${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)`)
          .join(', ')
        if (priceInfo) {
          answer += ` Current prices: ${priceInfo}.`
        }
      }
      
      // Add follow-up
      if (!answer.includes('?')) {
        answer += ' Want me to check more details?'
      }
      
      // Return KB answer immediately (no need to wait for AI)
      return NextResponse.json({
        answer,
        model: 'knowledge-base',
        modelBadge: 'Knowledge Base',
        latency: 0,
        cached: true,
        section: section || undefined,
        tickers: tickers.length > 0 ? tickers : undefined,
      })
    }
    
    // 5. Build enhanced prompt using knowledge base
    const enhancedPrompt = buildKnowledgePrompt(query, kb, relevantContext)
    
    // 6. Select best model based on query and knowledge base
    const selectedModel = selectBestModel(query, relevantContext, Object.keys(context.prices || {}).length > 0)
    
    // 7. Build system prompt with knowledge base examples
    const systemPrompt = `You are BullishAI — a conversational market analyst who chats casually about stocks, trends, and insights. 
You're friendly, confident, and human-like. Avoid robotic tables or bullet-point spam unless explicitly asked.

${relevantContext.length > 0 ? `\nUse these examples from our knowledge base as style guides:\n${relevantContext.slice(0, 3).map(ctx => `Q: ${ctx.question}\nA: ${ctx.answer}`).join('\n\n')}\n` : ''}

Guidelines:
- Match the conversational style of the examples above
- Keep answers concise (1-3 sentences typically)
- Use natural, conversational language
- Add emojis sparingly for friendliness
- Always end with a conversational follow-up question
- Never show error JSON or technical details to users
- If you don't have data, say so naturally: "I don't have that info right now, but I can check [alternative]"
- Include disclaimers naturally: "Not financial advice, but..." or "Just my take, not a recommendation"

Tone: Chatty, confident, helpful, not robotic.`

    const fullQuery = query

    // 8. Route to appropriate model with enhanced prompt
    let response
    try {
      // Use the selected model
      response = await routeAIQuery(fullQuery, context, systemPrompt, undefined, selectedModel)
    } catch (error: any) {
      console.error('AI model error:', error.message || error)
      console.error('Error stack:', error.stack)
      
      // Always try knowledge base first as fallback (before trying other models)
      if (relevantContext.length > 0) {
        console.log('Using knowledge base fallback, found', relevantContext.length, 'matches')
        const fallbackAnswer = relevantContext[0].answer
        return NextResponse.json({
          answer: fallbackAnswer,
          model: 'knowledge-base',
          modelBadge: 'Knowledge Base',
          latency: 0,
          cached: true,
        })
      }
      
      // If no KB match, try to reload KB and search again
      try {
        const kbRetry = await loadKnowledgeBase()
        const retryMatches = findBestMatch(query, kbRetry, 3)
        if (retryMatches.length > 0) {
          console.log('Retry KB search found', retryMatches.length, 'matches')
          return NextResponse.json({
            answer: retryMatches[0].answer,
            model: 'knowledge-base',
            modelBadge: 'Knowledge Base',
            latency: 0,
            cached: true,
          })
        }
      } catch (kbRetryError) {
        console.error('KB retry failed:', kbRetryError)
      }
      
      // Handle rate limits gracefully - try alternative model
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        // Try Gemini as fallback if Groq fails
        if (selectedModel === 'groq-llama') {
          try {
            console.log('Groq rate limited, trying Gemini...')
            response = await routeAIQuery(fullQuery, context, systemPrompt, undefined, 'gemini')
          } catch (geminiError) {
            // Both failed, use knowledge base answer
            const fallbackAnswer = relevantContext.length > 0
              ? relevantContext[0].answer
              : "Looks like I hit my request limit — but here's a quick summary from cached data. The market's been active today. Want me to check specific tickers when I'm back online?"
            
            return NextResponse.json({
              answer: fallbackAnswer,
              model: 'fallback-cached',
              modelBadge: 'Cached',
              latency: 0,
              cached: true,
            })
          }
        } else {
          // Try Groq as fallback if other model fails
          try {
            response = await routeAIQuery(fullQuery, context, systemPrompt, undefined, 'groq-llama')
          } catch (fallbackError) {
            const fallbackAnswer = relevantContext.length > 0
              ? relevantContext[0].answer
              : "Looks like I hit my request limit. Want me to check specific tickers when I'm back online?"
            
            return NextResponse.json({
              answer: fallbackAnswer,
              model: 'fallback-cached',
              modelBadge: 'Cached',
              latency: 0,
              cached: true,
            })
          }
        }
      } else {
        // For any other error, use knowledge base
        const fallbackAnswer = relevantContext.length > 0
          ? relevantContext[0].answer
          : "I'm having trouble connecting to the AI right now, but based on my knowledge base: The market's been active today. Want me to check specific tickers?"
        
        return NextResponse.json({
          answer: fallbackAnswer,
          model: 'knowledge-base',
          modelBadge: 'Knowledge Base',
          latency: 0,
          cached: true,
        })
      }
    }

    // 6. Format response naturally
    let answer = response.answer || "I'm not sure how to answer that right now. Can you rephrase?"
    
    // If we have a very good knowledge base match, enhance the answer
    if (relevantContext.length > 0 && relevantContext[0]) {
      const bestMatch = relevantContext[0]
      // If the answer is too generic or matches the knowledge base closely, use KB answer as base
      if (answer.length < 50 || answer.toLowerCase().includes(bestMatch.answer.toLowerCase().substring(0, 20))) {
        // Enhance with real-time data if available
        if (Object.keys(context.prices || {}).length > 0) {
          // Keep AI-generated answer but ensure it's informative
        } else {
          // Use knowledge base answer as fallback if AI answer is too short
          if (answer.length < 30) {
            answer = bestMatch.answer
          }
        }
      }
    }
    
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
    
    // Try to use knowledge base as fallback even on errors
    try {
      const kb = await loadKnowledgeBase().catch(() => [])
      if (kb.length > 0 && query) {
        const relevantContext = findBestMatch(query, kb, 3)
        
        if (relevantContext.length > 0) {
          const fallbackAnswer = relevantContext[0].answer
          return NextResponse.json({
            answer: fallbackAnswer,
            model: 'knowledge-base',
            modelBadge: 'Knowledge Base',
            latency: 0,
            cached: true,
          })
        }
      }
    } catch (kbError) {
      console.error('Knowledge base fallback also failed:', kbError)
    }
    
    // Final fallback - never show raw errors to users
    return NextResponse.json({
      answer: "Sorry, I'm having a bit of trouble right now. Can you try rephrasing that? Or ask me about something else — I'm great with stock prices, market trends, and quick insights!",
      model: 'error-fallback',
      modelBadge: 'Error',
      latency: 0,
    })
  }
}

