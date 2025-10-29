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

    const systemPrompt = `You are BullishAI, a real-time equity analyst. Your role is to answer user queries about stocks with data-driven explanations using real-time tools.

CRITICAL RULES:
1) NEVER return generic filler like "I'm here to help with stock analysis"
2) ALWAYS detect the ticker from the query, call tools, and provide a structured response
3) Use this EXACT template for "why did [TICKER] move" queries:

📈 {Company} ({SYMBOL}) — ${price} ({change%})
Key Metrics
• Volume: {vol} • Market Cap: {mktcap} • 52W: {low}–{high}
Drivers / News (last 24–72h)
• {Headline 1} — {why it matters} (Source, {time})
• {Headline 2} — {why it matters} (Source, {time})
• {Optional 3rd bullet}
Sentiment
• {label: Bullish/Neutral/Bearish} ({score})
Brief Take
{one or two sentences linking data to move; mention support/resistance if useful}
Updated: {local time} • {Pre-Market/Regular/After Hours}
Sources: {provider names}
_Not investment advice._

4) For "what is [company]" → fetch profile, show sector, CEO, HQ, market cap, 52W range, and recent news
5) For screeners/comparisons → fetch financials for each ticker and create a brief comparison table
6) If data is insufficient, say "No clear catalyst in the last 24h from top sources" and explain why
7) ALWAYS call getQuote, getNews, and getSentiment tools for movement queries
8) Be concise, factual, cite sources with timestamps, one screen of text max

The user provided symbol context: ${symbol || 'none'}`

    // If symbol is provided, prepend it to the query for context
    const enhancedQuery = symbol && !query.toLowerCase().includes(symbol.toLowerCase()) 
      ? `[Focusing on ${symbol}] ${query}`
      : query
    
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: enhancedQuery },
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


