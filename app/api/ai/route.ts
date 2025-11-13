import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Groq from 'groq-sdk'
import * as Tools from '@/lib/tools'
import { summarizeNews } from '@/lib/gemini'
import { getSession } from '@/lib/auth-server'

// Format timestamp to ET
function formatET(date: Date): string {
  return new Date(date.getTime()).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' ET'
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '' })

const GetQuoteArgs = z.object({ symbol: z.string() })
const GetNewsArgs = z.object({ symbol: z.string(), lookbackHours: z.number().default(48) })
const GetProfileArgs = z.object({ symbol: z.string() })
const GetFinancialsArgs = z.object({ symbol: z.string(), period: z.enum(['annual', 'quarter']).default('quarter') })
const GetSentimentArgs = z.object({ symbol: z.string(), lookbackHours: z.number().default(48) })

const tools: any[] = [
  { 
    type: 'function', 
    function: { 
      name: 'get_quote', 
      description: 'Get real-time/near-real-time quote for a ticker symbol. Returns price, change%, volume, market cap, P/E ratio, and 52-week range. Always use this for current prices. Use ticker symbols like AMZN, MSFT, AAPL.', 
      parameters: { 
        type: 'object', 
        properties: { 
          symbol: { type: 'string', description: 'Stock ticker symbol (e.g., AMZN for Amazon, MSFT for Microsoft, AAPL for Apple). Always use ticker symbols, not company names.' },
          fields: { type: 'array', items: { type: 'string' }, description: 'Optional fields to return' }
        }, 
        required: ['symbol'] 
      } 
    } 
  },
  { 
    type: 'function', 
    function: { 
      name: 'get_news', 
      description: 'Get latest reputable headlines for tickers/topics. Returns 1-2 line summaries of breaking/relevant news with sources and timestamps. Always use this to explain why a stock moved. Use ticker symbols (e.g., AMZN, MSFT) not company names.', 
      parameters: { 
        type: 'object', 
        properties: { 
          symbols: { 
            type: 'array', 
            items: { type: 'string' }, 
            description: 'Array of ticker symbols (e.g., ["AMZN", "MSFT"]). Use ticker symbols, not company names.' 
          },
          query: { 
            type: 'string', 
            description: 'Ticker symbol (e.g., "AMZN" for Amazon). Always use ticker symbols, not company names.' 
          },
          limit: { 
            type: 'number', 
            description: 'Number of results (default: 10)' 
          }
        },
        required: []
      } 
    } 
  },
  { 
    type: 'function', 
    function: { 
      name: 'get_trending', 
      description: 'Get most active/trending movers in the market', 
      parameters: { 
        type: 'object', 
        properties: { 
          market: { type: 'string', enum: ['US', 'CA', 'EU', 'CRYPTO'], description: 'Market (default: US)' },
          limit: { type: 'number', description: 'Number of results (default: 20)' }
        }
      } 
    } 
  },
  { 
    type: 'function', 
    function: { 
      name: 'get_earnings', 
      description: 'Get upcoming/recent earnings for a symbol', 
      parameters: { 
        type: 'object', 
        properties: { 
          symbol: { type: 'string', description: 'Ticker symbol' },
          range: { type: 'string', enum: ['last', 'next', 'calendar'], description: 'Range (default: last)' }
        },
        required: ['symbol']
      } 
    } 
  },
  { 
    type: 'function', 
    function: { 
      name: 'web_search', 
      description: 'Fallback web search for company IR pages, filings, official PRs', 
      parameters: { 
        type: 'object', 
        properties: { 
          query: { type: 'string', description: 'Search query' },
          site_filters: { type: 'array', items: { type: 'string' }, description: 'Domains to prefer, e.g., sec.gov, reuters.com' },
          limit: { type: 'number', description: 'Number of results (default: 5)' }
        },
        required: ['query']
      } 
    } 
  },
  { 
    type: 'function', 
    function: { 
      name: 'kb_retrieve', 
      description: 'Retrieve BullishAI docs by query. Use only for product/brand questions.', 
      parameters: { 
        type: 'object', 
        properties: { 
          query: { type: 'string', description: 'Query string' },
          top_k: { type: 'number', description: 'Number of results (default: 5)' }
        },
        required: ['query']
      } 
    } 
  },
]

// Helper to normalize company names to tickers
function normalizeToTicker(input: string): string {
  if (!input) return ''
  const lower = input.toLowerCase().trim()
  
  // Company name mappings
  const mapping: Record<string, string> = {
    'amazon': 'AMZN',
    'apple': 'AAPL',
    'microsoft': 'MSFT',
    'google': 'GOOGL',
    'alphabet': 'GOOGL',
    'tesla': 'TSLA',
    'nvidia': 'NVDA',
    'meta': 'META',
    'facebook': 'META',
    'netflix': 'NFLX',
    'amd': 'AMD',
    'intel': 'INTC',
  }
  
  if (mapping[lower]) return mapping[lower]
  
  // If already looks like a ticker (1-5 uppercase letters)
  if (/^[A-Z]{1,5}$/.test(input.trim())) return input.trim().toUpperCase()
  
  // Check for partial matches
  const found = Object.entries(mapping).find(([name]) => 
    lower.includes(name) || name.includes(lower)
  )
  
  return found ? found[1] : input.trim().toUpperCase()
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to use AI features.' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { query, symbol, sessionId } = (body || {}) as { query: string; symbol?: string; sessionId?: string }
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

    // Extract stock symbol from query if company name is used (e.g., "Amazon" -> "AMZN")
    let querySymbol = symbol
    if (!querySymbol && query) {
      querySymbol = normalizeToTicker(query)
    }

    const systemPrompt = `You are BullishAI's Market Analyst. You answer questions about stocks, markets, and the BullishAI product. You must ground answers in one or more of:

1. BullishAI Knowledge Base (RAG)
2. Live market data APIs (prices, fundamentals)
3. News APIs & web search (latest headlines, catalysts, filings)

If a fact is time-sensitive (prices, earnings, guidance, macro, analyst ratings, options flow, anything that could change today), you MUST call the appropriate tool instead of guessing.

📋 OUTPUT TEMPLATE (use EXACTLY this for "why did X move" queries):

📈 {Company} ({Symbol}) — $XX.XX (+X.XX% / ±$X.XX)
Vol: XX.X M | Mkt Cap: $X.XX T | 52W: $XX–$XX
Updated: YYYY-MM-DD HH:mm ET — Nasdaq Real-Time

Drivers / News
• [Publisher — Time] {1-2 line summary of breaking news catalyst}
• [Publisher — Time] {1-2 line summary of breaking news catalyst}

Sentiment: {Bullish / Neutral / Bearish} (score)
Brief Take: {1–2 sentences interpreting why price moved}

Sources: {provider names, times in ET}

🎯 CRITICAL RULES:
1) NEVER say "I'm here to help" or use generic chatbot language
2) NEVER output "No recent news available" — always call get_news tool when discussing stocks to fetch real news
3) ALWAYS fetch news when providing stock information. For trending stocks, the get_trending tool includes news for top gainers - use it.
4) ALWAYS cite news/tool outputs with publisher + date/time (e.g., "Reuters — 2025-10-30 14:05 ET")
5) ALWAYS timestamp any price or return metric with exchange + time zone (ET)
6) NEVER include disclaimers like "_Not financial advice_" — provide clear, factual analysis only
7) If news summaries are provided, use them instead of raw headlines
8) When discussing trending stocks or gainers, always check the news field in get_trending results for news about top stocks

When news is available via tools, ALWAYS use the provided summaries (1-2 lines each) in the Drivers/News section.
When no recent news is available, provide plausible explanations based on:
- Technical patterns (resistance/support, oversold/overbought)
- Sector dynamics (broader tech rally, sector rotation)
- Volume analysis (institutional interest, technical trading)
- Market context (risk-on rally, interest rate changes)
- Company-specific factors (earnings confidence, product launches)

User provided symbol context: ${querySymbol || symbol || 'none'}
When the user mentions a company name (e.g., "Amazon", "Microsoft"), always use the ticker symbol (AMZN, MSFT) when calling tools.`

    // Enhance query with symbol context
    const enhancedQuery = querySymbol && !query.toLowerCase().includes(querySymbol.toLowerCase())
      ? `[Stock: ${querySymbol}] ${query}`
      : query
    
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: enhancedQuery },
    ]

    // If query mentions "why did X go up/down" or similar, manually call tools before AI
    const lowerQuery = query.toLowerCase()
    const isWhyQuery = lowerQuery.includes('why') && (lowerQuery.includes('go up') || lowerQuery.includes('go down') || lowerQuery.includes('went up') || lowerQuery.includes('went down') || lowerQuery.includes('move'))
    const isPriceQuery = lowerQuery.includes('price') || lowerQuery.includes('quote')
    const isNewsQuery = lowerQuery.includes('news')
    const isStockQuery = querySymbol || symbol || lowerQuery.match(/[A-Z]{1,5}/)
        const isTrendingQuery = lowerQuery.includes('trending') || lowerQuery.includes('gainer') || lowerQuery.includes('biggest') || lowerQuery.includes('top')
        const isEarningsQuery = lowerQuery.includes('earnings') || lowerQuery.includes('report') || lowerQuery.includes('eps')
    
    let manualToolResults: any[] = []
    
    // For trending queries, get trending data (which includes news)
    if (isTrendingQuery) {
      try {
        const trendingResult = await Tools.getTrending('US', 20)
        if (trendingResult.data && !trendingResult.error) {
          manualToolResults.push({ name: 'get_trending', data: trendingResult.data })
        }
      } catch (manualError: any) {
        console.error('Manual trending tool execution error:', manualError)
      }
    }
    
        // For individual stock queries, get quote and news
        if ((isWhyQuery || isPriceQuery || isNewsQuery || isStockQuery || isEarningsQuery) && !isTrendingQuery) {
      const targetSymbol = querySymbol || symbol
      if (targetSymbol) {
        try {
          // Always get quote
          const quoteResult = await Tools.getQuote(normalizeToTicker(targetSymbol))
          if (quoteResult.data && !quoteResult.error) {
            manualToolResults.push({ name: 'get_quote', data: quoteResult.data })
          }
          
          // Always get news for stock queries
          const newsResult = await Tools.getNews(normalizeToTicker(targetSymbol))
          if (newsResult.data && !newsResult.error) {
            manualToolResults.push({ name: 'get_news', data: newsResult.data })
          }

              // If earnings-related, also fetch earnings (next window)
              if (isEarningsQuery) {
                const earningsResult = await Tools.getEarnings(normalizeToTicker(targetSymbol), 'next')
                if (earningsResult.data && !earningsResult.error) {
                  manualToolResults.push({ name: 'get_earnings', data: earningsResult.data })
                }
              }
        } catch (manualError: any) {
          console.error('Manual tool execution error:', manualError)
        }
      }
    }

    let first
    try {
      first = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
      })
    } catch (groqError: any) {
      console.error('Groq API error:', groqError)
      
      // If we have manual tool results, use them directly
      if (manualToolResults.length > 0) {
        // Create a synthetic response using manual tool results
        const syntheticMsg = {
          role: 'assistant' as const,
          content: null,
          tool_calls: manualToolResults.map((r, idx) => ({
            id: `manual_${idx}`,
            type: 'function' as const,
            function: {
              name: r.name,
              arguments: JSON.stringify(r.data),
            }
          }))
        }
        
        // Process these tool results and generate final response
        const followResult = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.2,
          messages: [
            ...messages,
            syntheticMsg,
            ...manualToolResults.map(r => ({
              role: 'tool' as const,
              tool_call_id: `manual_${manualToolResults.indexOf(r)}`,
              content: JSON.stringify({ name: r.name, data: r.data }, null, 2)
            }))
          ],
        })
        
        const finalMsg = followResult.choices[0]?.message
        return NextResponse.json({
          answer: finalMsg?.content || 'Unable to generate response',
          usage: { total_tokens: 0 }
        })
      }
      
      // Fallback: try without tools if tool calling fails
      if (groqError.message?.includes('tool')) {
        try {
          first = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.2,
            messages: [
              ...messages,
              { role: 'user', content: `${enhancedQuery}\n\nNote: Please provide a helpful answer based on general market knowledge. If you need specific data, mention that the user should specify a ticker symbol (e.g., "AMZN" for Amazon, "MSFT" for Microsoft).` }
            ],
          })
        } catch (fallbackError: any) {
          throw new Error(`Groq API failed: ${groqError.message || 'Unknown error'}`)
        }
      } else {
        throw groqError
      }
    }

    let msg: any = first.choices[0]?.message
    
    // Handle tool calls
    if (msg?.tool_calls?.length) {
      const toolResults: any[] = []
      for (const call of msg.tool_calls) {
        try {
          const name = call.function?.name || call.function?.name
          if (!name) {
            console.error('Tool call missing name:', call)
            continue
          }
          
          let args: any = {}
          const rawArgs = call.function?.arguments
          if (rawArgs) {
            try {
              args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs
            } catch (parseError) {
              console.error(`Failed to parse tool args for ${name}:`, rawArgs, parseError)
              args = {}
            }
          }
          
          const data = await routeTool(name, args)
          
          // Ensure data is in correct format
          if (data && typeof data === 'object' && !data.error) {
            toolResults.push({ id: call.id || `call_${Date.now()}`, name, data })
          } else {
            console.error(`Tool ${name} returned error:`, data)
            toolResults.push({ 
              id: call.id || `call_${Date.now()}`, 
              name, 
              data: { error: data?.error || 'tool_execution_failed', message: data?.message || `Tool ${name} failed` }
            })
          }
        } catch (toolError: any) {
          console.error(`Tool execution error for ${call.function?.name}:`, toolError)
          toolResults.push({ 
            id: call.id || `call_${Date.now()}`, 
            name: call.function?.name || 'unknown', 
            data: { error: 'tool_execution_error', message: toolError.message }
          })
        }
      }

      // Enhance news data with summaries and format properly
      const enhancedToolResults = toolResults.map(r => {
        if (r.name === 'get_news' && r.data?.summaries && Array.isArray(r.data.summaries) && r.data.summaries.length > 0) {
          // Format summaries for better AI consumption
          const enhanced = {
            ...r.data,
            summariesFormatted: r.data.summaries.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n'),
            summaryCount: r.data.summaries.length,
            // Also include items for fallback
            items: r.data.items || []
          }
          return { ...r, data: enhanced }
        }
        // For get_news without summaries, ensure items are included
        if (r.name === 'get_news' && r.data?.items && Array.isArray(r.data.items) && r.data.items.length > 0) {
          const enhanced = {
            ...r.data,
            hasItems: true,
            itemCount: r.data.items.length,
            // Generate summaries from items if not already present
            itemsForSummarization: r.data.items.slice(0, 5).map((item: any) => ({
              headline: item.headline,
              summary: item.summary,
              source: item.source,
              datetime: item.datetime,
              formattedTime: item.formattedTime || (item.datetime ? formatET(new Date(item.datetime)) : 'Unknown')
            }))
          }
          return { ...r, data: enhanced }
        }
        return r
      })
      
      // If get_news was called but no summaries, generate them now using Gemini
      const newsTool = enhancedToolResults.find(r => r.name === 'get_news')
      if (newsTool && newsTool.data?.itemsForSummarization && (!newsTool.data.summaries || newsTool.data.summaries.length === 0)) {
        try {
          const summaries = await summarizeNews(newsTool.data.itemsForSummarization, 3)
          if (summaries.length > 0) {
            newsTool.data.summaries = summaries
            newsTool.data.summariesFormatted = summaries.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')
            newsTool.data.summaryCount = summaries.length
          }
        } catch (err) {
          console.error('Failed to generate news summaries:', err)
        }
      }

      const follow = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        messages: [
          ...messages,
          msg,
          ...enhancedToolResults.map(r => ({ role: 'tool' as const, tool_call_id: r.id, content: JSON.stringify({ name: r.name, data: r.data }, null, 2) })),
        ],
      })
      msg = follow.choices[0]?.message
    }

    // If we have an error in the message or no content, return helpful error
    if (!msg?.content && msg?.tool_calls?.length === 0) {
      return NextResponse.json({ 
        error: 'No response generated',
        answer: 'I apologize, but I encountered an error processing your request. Please try rephrasing your question or asking about a specific stock ticker.'
      }, { status: 500 })
    }

    return NextResponse.json({ 
      answer: msg?.content || 'No answer',
      usage: first.usage 
    })
  } catch (e: any) {
    console.error('AI route error:', e)
    return NextResponse.json({ 
      error: e?.message || 'ai_error',
      answer: `I encountered an error: ${e?.message || 'Unknown error'}. Please try asking again or be more specific (e.g., "why did AMZN go up today?").`
    }, { status: 500 })
  }
}

async function routeTool(name: string, rawArgs: any) {
  try {
    if (name === 'get_quote') {
      const symbol = rawArgs.symbol || rawArgs.query
      if (!symbol) return { error: 'symbol_required' }
      const normalizedSymbol = normalizeToTicker(symbol)
      const result = await Tools.getQuote(normalizedSymbol, rawArgs.fields)
      if (result.error) {
        return { error: result.error }
      }
      return result.data || result
    }
    if (name === 'get_news') {
      // Support multiple argument formats
      const query = rawArgs.query
      const symbols = rawArgs.symbols
      const symbol = rawArgs.symbol
      
      // Determine the ticker/query to use and normalize
      let tickerOrQuery = symbols?.[0] || symbol || query
      if (!tickerOrQuery) {
        return { items: [], summaries: [], error: 'query_or_symbol_required' }
      }
      
      // Normalize company names to tickers
      tickerOrQuery = normalizeToTicker(tickerOrQuery)
      const normalizedSymbols = symbols ? symbols.map((s: string) => normalizeToTicker(s)) : undefined
      
      const result = await Tools.getNews(
        tickerOrQuery,
        normalizedSymbols,
        rawArgs.from,
        rawArgs.to,
        rawArgs.limit || 10,
        rawArgs.languages || ['en']
      )
      
      if (result.error) {
        return { items: [], summaries: [], error: result.error }
      }
      
      return result.data || result
    }
    if (name === 'get_trending') {
      const result = await Tools.getTrending(rawArgs.market || 'US', rawArgs.limit || 20)
      return result.data || result
    }
    if (name === 'get_earnings') {
      const symbol = rawArgs.symbol || rawArgs.query
      if (!symbol) return { error: 'symbol_required' }
      const normalizedSymbol = normalizeToTicker(symbol)
      const result = await Tools.getEarnings(normalizedSymbol, rawArgs.range || 'last')
      if (result.error) {
        return { error: result.error }
      }
      return result.data || result
    }
    if (name === 'web_search') {
      if (!rawArgs.query) return { error: 'query_required' }
      const result = await Tools.webSearch(rawArgs.query, rawArgs.site_filters, rawArgs.limit || 5)
      return result.data || result
    }
    if (name === 'kb_retrieve') {
      if (!rawArgs.query) return { error: 'query_required' }
      const result = await Tools.kbRetrieve(rawArgs.query, rawArgs.top_k || 5)
      return result.data || result
    }
    return { error: 'unknown_tool', name }
  } catch (error: any) {
    console.error(`Tool ${name} error:`, error.message)
    return { error: error.message || 'tool_error', name }
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


