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
  { type: 'function', function: { name: 'getQuote', description: 'Get real-time price, change%, volume, market cap, P/E ratio, and 52-week range for a stock ticker symbol', parameters: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } } },
  { type: 'function', function: { name: 'getNews', description: 'Get recent headlines and news articles for a stock from the last 24-72 hours. Returns headline titles and sources. Use this to explain why a stock moved.', parameters: { type: 'object', properties: { symbol: { type: 'string' }, lookbackHours: { type: 'number', default: 48 } }, required: ['symbol'] } } },
  { type: 'function', function: { name: 'getProfile', description: 'Get company profile information including CEO, headquarters, sector, industry, website, and business summary', parameters: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } } },
  { type: 'function', function: { name: 'getFinancials', description: 'Get quarterly or annual financial statements including revenue, EPS, profit margins, cash reserves', parameters: { type: 'object', properties: { symbol: { type: 'string' }, period: { type: 'string', enum: ['annual', 'quarter'] } }, required: ['symbol'] } } },
  { type: 'function', function: { name: 'getSentiment', description: 'Get aggregated sentiment score (-1 to +1) from recent news and headlines', parameters: { type: 'object', properties: { symbol: { type: 'string' }, lookbackHours: { type: 'number', default: 48 } }, required: ['symbol'] } } },
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, symbol, sessionId } = (body || {}) as { query: string; symbol?: string; sessionId?: string }
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

    const systemPrompt = process.env.BULLISHAI_SYSTEM_PROMPT || `You are BullishAI, a real-time market analyst. Always:
1) Detect tickers/company names and timeframe from user query
2) For "why did X rise/fall today" → fetch live quote + 24-72h news + sentiment
3) For "what is X" → fetch company profile + quote + key metrics
4) For stock screeners → use runScreener to filter
5) Be factual, cite sources (provider + headline/title), include timestamps
6) If uncertain, say so. Never fabricate data.

ALWAYS call getQuote, getNews, and getSentiment tools when user asks "why did X move" to get actual drivers.

Return sections:
• Price & Change (with arrow ↑↓)
• Key Metrics (volume, market cap, P/E if available)  
• Drivers / News (2-5 headlines with sources + times) - THIS IS CRITICAL
• Sentiment Snapshot (score + label: bullish/neutral/bearish)
• Brief Take (1-2 sentences explaining the movement)

Always end with: "Not investment advice."`

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ]

    const first = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
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
        model: 'llama-3.1-70b-versatile',
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


