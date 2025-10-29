import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Groq from 'groq-sdk'
import * as Providers from '@/lib/providers'

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
      name: 'getQuote', 
      description: 'Get real-time price, change%, volume, market cap, P/E ratio, and 52-week range for a stock ticker symbol', 
      parameters: { 
        type: 'object', 
        properties: { symbol: { type: 'string', description: 'Stock ticker symbol (e.g., MSFT, AAPL)' } }, 
        required: ['symbol'] 
      } 
    } 
  },
  { 
    type: 'function', 
    function: { 
      name: 'getNews', 
      description: 'Get recent headlines and news articles for a stock from the last 24-72 hours. Returns headline titles and sources. Use this to explain why a stock moved.', 
      parameters: { 
        type: 'object', 
        properties: { 
          symbol: { type: 'string', description: 'Stock ticker symbol' }, 
          lookbackHours: { type: 'integer', description: 'Hours to look back (default: 48)' } 
        }, 
        required: ['symbol'] 
      } 
    } 
  },
  { 
    type: 'function', 
    function: { 
      name: 'getProfile', 
      description: 'Get company profile information including CEO, headquarters, sector, industry, website, and business summary', 
      parameters: { 
        type: 'object', 
        properties: { symbol: { type: 'string', description: 'Stock ticker symbol' } }, 
        required: ['symbol'] 
      } 
    } 
  },
  { 
    type: 'function', 
    function: { 
      name: 'getFinancials', 
      description: 'Get quarterly or annual financial statements including revenue, EPS, profit margins, cash reserves', 
      parameters: { 
        type: 'object', 
        properties: { 
          symbol: { type: 'string', description: 'Stock ticker symbol' }, 
          period: { type: 'string', enum: ['annual', 'quarter'], description: 'Time period' } 
        }, 
        required: ['symbol'] 
      } 
    } 
  },
  { 
    type: 'function', 
    function: { 
      name: 'getSentiment', 
      description: 'Get aggregated sentiment score (-1 to +1) from recent news and headlines', 
      parameters: { 
        type: 'object', 
        properties: { 
          symbol: { type: 'string', description: 'Stock ticker symbol' }, 
          lookbackHours: { type: 'integer', description: 'Hours to look back (default: 48)' } 
        }, 
        required: ['symbol'] 
      } 
    } 
  },
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, symbol, sessionId } = (body || {}) as { query: string; symbol?: string; sessionId?: string }
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

    const systemPrompt = `You are BullishAI, a real-time stock market analyst built into a Next.js dashboard. You must always talk like an informed, data-driven financial assistant — not a generic chatbot.

🎯 CRITICAL RULES:
1) NEVER say "I'm here to help with stock analysis."
2) NEVER output placeholders or apologies
3) ALWAYS give meaningful data-driven responses
4) ALWAYS include a disclaimer at the end

📋 OUTPUT TEMPLATE (use EXACTLY this for "why did X move" queries):

📈 {Company} ({Symbol}) — $XX.XX (+X.XX%)
Key Metrics
• Volume: XX.X M
• Market Cap: $X.XX T
• 52W Range: $XX–$XX
Drivers / News
• {headline 1} — {reason} (Source, Time)
• {headline 2} — {reason} (Source, Time)
Sentiment
• {Bullish / Neutral / Bearish} (score)
Brief Take
{1–2 sentences interpreting why price moved.}
Updated: {time EST}
Sources: {provider names}
_Not financial advice._

For "what is X" queries, show sector, CEO, HQ, market cap, 52W range, and recent news.
For screeners, list top matches with prices and brief reasons.
For comparisons, create a small comparison table.

Your knowledge sources: website knowledge (BullishAI docs), news knowledge (Finnhub/MarketAux/TwelveData/Yahoo), and user knowledge (watchlists).

IMPORTANT: When no recent news is available, you MUST still provide plausible explanations based on:
1. **Technical patterns**: e.g., "broke above resistance", "bounce from support", "oversold/overbought conditions"
2. **Sector dynamics**: Compare to broader sector (tech, retail, cloud, etc.) — "likely tracking broader tech rally" or "retail sector strength"
3. **Volume analysis**: "unusual volume suggesting institutional interest" or "light volume suggests technical trading"
4. **Market context**: "risk-on rally", "rotation into growth stocks", "benefit from falling interest rates"
5. **Company-specific factors**: "earnings beat confidence", "new product launch enthusiasm", "market share gains"

NEVER just say "no clear catalyst" — always provide AT LEAST 2-3 plausible reasons even if speculative. Be specific about potential catalysts (e.g., "strength in AWS cloud segment", "holiday retail momentum", "AI integration optimism").

User provided symbol context: ${symbol || 'none'}`

    // If symbol is provided, prepend it to the query for context
    const enhancedQuery = symbol && !query.toLowerCase().includes(symbol.toLowerCase()) 
      ? `[Focusing on ${symbol}] ${query}`
      : query
    
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: enhancedQuery },
    ]

    const first = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      messages,
      tools,
      tool_choice: 'auto',
    })

    let msg: any = first.choices[0]?.message
    if (msg?.tool_calls?.length) {
      const toolResults: any[] = []
      for (const call of msg.tool_calls) {
        const name = call.function.name
        let args: any = {}
        try { args = JSON.parse(call.function.arguments || '{}') } catch {}
        const data = await routeTool(name, args)
        toolResults.push({ id: call.id, name, data })
      }

      const follow = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        messages: [
          ...messages,
          msg,
          ...toolResults.map(r => ({ role: 'tool' as const, tool_call_id: r.id, content: JSON.stringify({ name: r.name, data: r.data }, null, 2) })),
        ],
      })
      msg = follow.choices[0]?.message
    }

    return NextResponse.json({ 
      answer: msg?.content || 'No answer',
      usage: first.usage 
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'ai_error' }, { status: 500 })
  }
}

async function routeTool(name: string, rawArgs: any) {
  if (name === 'getQuote') {
    const { symbol } = GetQuoteArgs.parse(rawArgs)
    return Providers.getQuote(symbol)
  }
  if (name === 'getNews') {
    const { symbol, lookbackHours } = GetNewsArgs.parse(rawArgs)
    return Providers.getNews(symbol, lookbackHours)
  }
  if (name === 'getProfile') {
    const { symbol } = GetProfileArgs.parse(rawArgs)
    return Providers.getProfile(symbol)
  }
  if (name === 'getFinancials') {
    const { symbol, period } = GetFinancialsArgs.parse(rawArgs)
    return Providers.getFinancials(symbol, period)
  }
  if (name === 'getSentiment') {
    const { symbol, lookbackHours } = GetSentimentArgs.parse(rawArgs)
    return Providers.getSentiment(symbol, lookbackHours)
  }
  return { error: 'unknown_tool' }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


