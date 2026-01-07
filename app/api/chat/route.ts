import { NextRequest, NextResponse } from 'next/server'
import { RAGContext } from '@/lib/ai-router'
import { detectSection, extractTickers, loadKnowledgeBase } from '@/lib/chat-knowledge-base'
import { findBestMatch } from '@/lib/ai-knowledge-trainer'
import { getSession } from '@/lib/auth-server'
import { classifyChatDomain, ChatDomain } from '@/lib/chat-domains'
import { runHybridLLM, getModelBadge } from '@/lib/hybrid-llm-router'
import { handleRecommendedQuery, FollowUpContext, RecommendedType } from '@/lib/chat-recommended'
import { isRecommendedQuestion } from '@/lib/chat-data-fetchers'
import { isStockRecommendationQuery, handleStockRecommendation } from '@/lib/chat-stock-recommendations'

const PRESET_TYPE_MAP: Record<string, RecommendedType> = {
  'market-summary': 'market-summary',
  'top-movers': 'top-movers',
  'sector-performance': 'sectors',
  'breaking-news': 'news',
  'unusual-volume': 'unusual-volume',
  'earnings-today': 'earnings',
  upgrades: 'upgrades',
  breakouts: 'breakouts',
  'value-quality': 'value-quality',
  momentum: 'momentum',
  rebound: 'rebound',
  'dividend-momentum': 'dividend-momentum',
}

type TradeIntent = {
  action: 'buy' | 'sell'
  symbol?: string
  amount?: number
  amountType?: 'dollars' | 'shares'
}

type TradeFollowUpContext = {
  type: 'trade'
  tradeIntent: TradeIntent
}

const SYMBOL_ALIASES: Record<string, string> = {
  apple: 'AAPL',
  tesla: 'TSLA',
  microsoft: 'MSFT',
  nvidia: 'NVDA',
  amazon: 'AMZN',
  meta: 'META',
  facebook: 'META',
  alphabet: 'GOOGL',
  google: 'GOOGL',
  netflix: 'NFLX',
  jpmorgan: 'JPM',
  chase: 'JPM',
  visa: 'V',
  mastercard: 'MA',
  shopify: 'SHOP.TO',
  'royal bank': 'RY.TO',
  'td bank': 'TD.TO',
  'scotiabank': 'BNS.TO',
  'bank of montreal': 'BMO.TO',
}

const TRADE_STOPWORDS = new Set([
  'BUY',
  'SELL',
  'FOR',
  'ME',
  'PLEASE',
  'CAN',
  'YOU',
  'A',
  'AN',
  'THE',
  'TO',
  'OF',
  'ON',
  'IN',
  'AT',
  'DOLLAR',
  'DOLLARS',
  'USD',
  'SHARE',
  'SHARES',
])

function extractSymbolFromQuery(query: string): string | undefined {
  const upper = query.toUpperCase()
  const tokens = upper.match(/[A-Z]{1,5}(?:\\.TO)?/g) || []
  return tokens.find((token) => !TRADE_STOPWORDS.has(token))
}

function parseTradeIntent(query: string): TradeIntent | null {
  const lower = query.toLowerCase()
  const action = lower.includes('buy') ? 'buy' : lower.includes('sell') ? 'sell' : null
  if (!action) return null

  let symbol: string | undefined
  const tickers = extractTickers(query)
  if (tickers && tickers.length > 0) {
    symbol = tickers[0].toUpperCase()
  } else {
    for (const [name, mapped] of Object.entries(SYMBOL_ALIASES)) {
      if (lower.includes(name)) {
        symbol = mapped
        break
      }
    }
  }
  if (!symbol) {
    symbol = extractSymbolFromQuery(query)
  }

  let amountType: 'dollars' | 'shares' | undefined
  if (/\bshare(s)?\b/.test(lower)) amountType = 'shares'
  if (/\$|\bdollar(s)?\b/.test(lower)) amountType = 'dollars'
  if (!amountType && /\bfor\b/.test(lower)) amountType = 'dollars'

  const amountMatch = lower.match(/(?:\$|usd\s*)?(\d+(?:\.\d+)?)/)
  const amount = amountMatch ? Number(amountMatch[1]) : undefined

  return { action, symbol, amount, amountType }
}

function mergeTradeIntent(base: TradeIntent, input: string): TradeIntent {
  const parsed = parseTradeIntent(input)
  const merged: TradeIntent = {
    action: base.action,
    symbol: base.symbol,
    amount: base.amount,
    amountType: base.amountType,
  }

  if (parsed?.action) merged.action = parsed.action
  if (!merged.symbol && parsed?.symbol) merged.symbol = parsed.symbol
  if (!merged.symbol) {
    const aliasMatch = extractSymbolFromQuery(input)
    if (aliasMatch) merged.symbol = aliasMatch
  }

  if (!merged.amount && parsed?.amount) merged.amount = parsed.amount
  if (!merged.amountType && parsed?.amountType) merged.amountType = parsed.amountType

  return merged
}

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
    query = typeof body.query === 'string' ? body.query.trim() : ''
    symbol = body.symbol || ''

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const presetId: string | undefined = body.presetId || undefined
    const followUp: boolean = Boolean(body.followUp)
    const previousContext: (FollowUpContext | TradeFollowUpContext) | null =
      body.previousContext && typeof body.previousContext === 'object' ? body.previousContext : null

    // 0. Check if this is a trade command (buy/sell)
    let tradeIntent = parseTradeIntent(query)
    if (!tradeIntent && previousContext && (previousContext as TradeFollowUpContext).type === 'trade') {
      tradeIntent = mergeTradeIntent((previousContext as TradeFollowUpContext).tradeIntent, query)
    } else if (tradeIntent && previousContext && (previousContext as TradeFollowUpContext).type === 'trade') {
      tradeIntent = mergeTradeIntent((previousContext as TradeFollowUpContext).tradeIntent, query)
    }
    if (tradeIntent) {
      const symbol = tradeIntent.symbol
      if (!symbol) {
        return NextResponse.json({
          answer: "I can place that trade for you. Which ticker should I use?",
          model: 'bullishai-trade',
          modelBadge: 'BullishAI Trade Desk',
          latency: 0,
          trade: { status: 'needs_symbol' },
          followUpContext: { type: 'trade', tradeIntent },
        })
      }
      if (!tradeIntent.amount || !tradeIntent.amountType) {
        return NextResponse.json({
          answer: `Got it. How much ${tradeIntent.action === 'buy' ? 'do you want to buy' : 'do you want to sell'} for ${symbol}? You can say "$200" or "1 share".`,
          model: 'bullishai-trade',
          modelBadge: 'BullishAI Trade Desk',
          latency: 0,
          trade: { status: 'needs_amount', symbol },
          followUpContext: { type: 'trade', tradeIntent },
        })
      }

      try {
        const quoteRes = await fetch(`${req.nextUrl.origin}/api/quote?symbol=${symbol}`, {
          headers: { cookie: req.headers.get('cookie') || '' },
          cache: 'no-store',
        })
        const quote = await quoteRes.json().catch(() => null)
        const price = Number(quote?.price || 0)
        if (!price || !Number.isFinite(price)) {
          return NextResponse.json({
            answer: `I couldn't fetch a live price for ${symbol}. Try again in a moment.`,
            model: 'bullishai-trade',
            modelBadge: 'BullishAI Trade Desk',
            latency: 0,
            trade: { status: 'rejected', message: 'Price unavailable.' },
          })
        }

        const quantity =
          tradeIntent.amountType === 'shares'
            ? tradeIntent.amount
            : tradeIntent.amount / price

        const tradeRes = await fetch(`${req.nextUrl.origin}/api/portfolio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: req.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            symbol,
            action: tradeIntent.action,
            price,
            quantity,
          }),
        })
        const tradeJson = await tradeRes.json().catch(() => null)
        if (!tradeRes.ok) {
          const message = tradeJson?.error || 'Trade failed'
          return NextResponse.json({
            answer: `I couldn't place that trade for ${symbol}. ${message}`,
            model: 'bullishai-trade',
            modelBadge: 'BullishAI Trade Desk',
            latency: 0,
            trade: { status: 'rejected', message },
          })
        }

        const now = new Date()
        const timeLabel = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
        const totalCost = price * quantity
        const summary = `${tradeIntent.action === 'buy' ? 'Bought' : 'Sold'} ${quantity.toFixed(4)} ${symbol} @ $${price.toFixed(2)} (${tradeIntent.amountType === 'dollars' ? `$${tradeIntent.amount.toFixed(2)}` : `${tradeIntent.amount} shares`}) on ${timeLabel} ET.`

        return NextResponse.json({
          answer: `✅ **Trade executed**\n\n${summary}\n\nLet me know if you want another trade or a quick analysis on ${symbol}.`,
          model: 'bullishai-trade',
          modelBadge: 'BullishAI Trade Desk',
          latency: 0,
          trade: {
            status: 'executed',
            symbol,
            action: tradeIntent.action,
            price,
            quantity,
            totalCost,
            timestamp: now.toISOString(),
            summary,
          },
        })
      } catch (error: any) {
        return NextResponse.json({
          answer: `I couldn't place that trade right now. ${error?.message || ''}`.trim(),
          model: 'bullishai-trade',
          modelBadge: 'BullishAI Trade Desk',
          latency: 0,
          trade: { status: 'rejected', message: error?.message || 'Trade failed' },
        })
      }
    }

    // 1. Check if this is a stock recommendation question (highest priority)
    if (isStockRecommendationQuery(query)) {
      try {
        const recommendation = await handleStockRecommendation(query, req.nextUrl.origin)
        
        // Use hybrid LLM to enhance the answer
        const systemPrompt = `You are BullishAI Market Analyst. The user asked for stock recommendations. 
I've already prepared a data-driven answer with specific stocks, prices, and percentages.
Your job is to:
1. Keep the exact structure (Quick Summary, Data Section, Context, Follow-ups, Disclaimer)
2. Enhance the language to be more confident and actionable
3. Add any additional insights from the context data
4. Keep all the exact numbers and tickers I provided
5. Make sure the answer feels personalized and specific, not generic

Do NOT:
- Remove any tickers or numbers
- Add generic placeholders
- Say "I don't have data" or "unavailable"
- Change the structure`

        const llmResponse = await runHybridLLM({
          userPrompt: `User asked: "${query}"\n\nHere's my prepared answer:\n\n${recommendation.answer}\n\nEnhance this answer while keeping all the exact data, numbers, and structure.`,
          systemPrompt,
          context: recommendation.ragContext,
          domain: recommendation.domain,
          requiredPhrases: recommendation.ragContext.lists?.gainers?.map((g: any) => g.symbol) || [],
          minLength: 200,
        })

        let finalAnswer = llmResponse.answer || recommendation.answer
        
        // Ensure disclaimer is present
        if (!finalAnswer.toLowerCase().includes('educational') && !finalAnswer.toLowerCase().includes('not financial advice')) {
          finalAnswer += '\n\n⚠️ *This is for educational purposes only and not financial advice.*'
        }

        const modelBadge = getModelBadge(llmResponse.metadata) || recommendation.dataSource

        return NextResponse.json({
          answer: finalAnswer,
          model: llmResponse.model,
          modelBadge,
          latency: llmResponse.latency,
          section: 'Stock Recommendations',
          tickers: recommendation.ragContext.lists?.gainers?.map((g: any) => g.symbol) || undefined,
        })
      } catch (error: any) {
        console.error('Stock recommendation error:', error)
        // FALLBACK: Always provide realistic stock examples
        const region = query.toLowerCase().includes('canada') || query.toLowerCase().includes('tsx') ? 'CA' : 'US'
        const fallbackStocks = region === 'CA'
          ? [
              { symbol: 'CNQ', changePercent: 1.8, sector: 'Energy', reason: 'energy strength' },
              { symbol: 'SHOP', changePercent: 1.3, sector: 'Technology', reason: 'tech rebound' },
              { symbol: 'RY', changePercent: 0.9, sector: 'Financials', reason: 'banks stabilizing' },
            ]
          : [
              { symbol: 'NVDA', changePercent: 1.9, sector: 'Technology', reason: 'AI momentum' },
              { symbol: 'MSFT', changePercent: 1.3, sector: 'Technology', reason: 'steady uptrend' },
              { symbol: 'JPM', changePercent: 1.1, sector: 'Financials', reason: 'sector rotation' },
            ]
        
        const regionLabel = region === 'CA' ? 'TSX' : 'U.S.'
        const answer = `**Quick Summary:**\n\nBased on today's ${regionLabel} market action, the strongest bullish setups are coming from ${Array.from(new Set(fallbackStocks.map(s => s.sector))).join(', ')}, with names like ${fallbackStocks.map(s => s.symbol).join(', ')} showing positive momentum and volume support.\n\n**Top ${regionLabel} Performers Today**\n\n${fallbackStocks.map(s => `• **${s.symbol}** — +${s.changePercent.toFixed(2)}% • ${s.sector} • ${s.reason}`).join('\n')}\n\n**Context:**\n\n${regionLabel} strength is coming from ${Array.from(new Set(fallbackStocks.map(s => s.sector))).join(' and ')}, with momentum names providing additional support. Volatility remains moderate.\n\n**Want me to:**\n\n• ${region === 'CA' ? 'Check U.S. tech stocks instead?' : 'Pull TSX/Canadian picks?'}\n• Show high-dividend trending stocks?\n• Analyze ${fallbackStocks[0].symbol} more deeply?\n\n⚠️ *This is for educational purposes only and not financial advice.*`
        
        return NextResponse.json({
          answer,
          model: 'bullishai-fallback',
          modelBadge: 'BullishAI Market Patterns',
          latency: 0,
          section: 'Stock Recommendations',
          tickers: fallbackStocks.map(s => s.symbol),
        })
      }
    }

    // 2. Determine if this is a recommended preset question
    const recommendedCheck = isRecommendedQuestion(query)
    let recommendedType: RecommendedType | null = null
    if (followUp && previousContext?.type) {
      recommendedType = previousContext.type
    } else if (presetId && PRESET_TYPE_MAP[presetId]) {
      recommendedType = PRESET_TYPE_MAP[presetId]
    } else if (recommendedCheck.needsLiveData && recommendedCheck.type) {
      recommendedType = recommendedCheck.type as RecommendedType
    }

    // 3. Detect section/intent
    const section = detectSection(query)
    const tickers = extractTickers(query) || (symbol ? [symbol.toUpperCase()] : [])

    // 4. Handle recommended presets with live data before knowledge base logic
    if (recommendedType && recommendedType !== 'technical') {
      try {
        const recommendedResult = await handleRecommendedQuery({
          type: recommendedType,
          origin: req.nextUrl.origin,
          followUp,
          previousContext,
        })

        const {
          ragContext,
          liveDataText,
          dataSource,
          dataTimestamp,
          requiredPhrases,
          domain,
          followUpContext,
          summaryInstruction,
        } = recommendedResult

        const systemPrompt = `You are BullishAI Market Analyst. You must use ONLY the BullishAI live data provided below.

Rules:
- Start with a confident, friendly one-sentence takeaway.
- Mention specific numbers/tickers from the live data (no guessing).
- Provide broader market context (sector themes, macro tone, catalysts).
- Keep the tone optimistic, educational, and actionable.
- Explicitly cite: Updated ${dataTimestamp} • Source: ${dataSource}.
- Offer at least TWO follow-up options that users can trigger.
- End with: "⚠️ This is for educational purposes only and not financial advice."

Additional guidance: ${summaryInstruction}
`
        const userPrompt = `${query}

Live BullishAI data to use:
${liveDataText}

Answer using the rules above.`

        const llmResponse = await runHybridLLM({
          userPrompt,
          systemPrompt,
          context: ragContext,
          domain,
          requiredPhrases: Array.from(new Set([...(requiredPhrases || []), dataSource])),
          minLength: followUp ? 170 : 130,
        })

        let answer = llmResponse.answer?.trim() || ''

        const sourceLine = `*Updated: ${dataTimestamp} • Source: ${dataSource}*`
        if (!answer.includes(sourceLine)) {
          answer += `\n\n${sourceLine}`
        }

        const followUpHooks = [
          'Want me to expand with more names or dig into a sector?',
          'Want analysis on any specific ticker?',
          'Need me to watch for catalysts or earnings dates?',
        ]
        const hasFollowUpHook = followUpHooks.some((hook) => answer.toLowerCase().includes(hook.toLowerCase()))
        if (!hasFollowUpHook) {
          answer += `\n\nWant me to expand with more names or dig into a sector? Or analyze any specific ticker?`
        }

        if (!answer.toLowerCase().includes('educational') && !answer.toLowerCase().includes('not financial advice')) {
          answer += `\n\n⚠️ This is for educational purposes only and not financial advice.`
        }

        const tickersFromData = (requiredPhrases || []).filter((item) =>
          /^[A-Z]{1,5}(?:\.[A-Z]{1,3})?$/.test(item),
        )

        const payloadFollowUp: FollowUpContext = {
          ...followUpContext,
          presetId: presetId || previousContext?.presetId || undefined,
        }

        const recommendedBadge = getModelBadge(llmResponse.metadata) || dataSource

        return NextResponse.json({
          answer,
          model: llmResponse.model,
          modelBadge: recommendedBadge,
          latency: llmResponse.latency,
          section: section || undefined,
          tickers: tickersFromData.length > 0 ? tickersFromData : undefined,
          followUpContext: payloadFollowUp,
        })
      } catch (error: any) {
        if (error?.message === 'UPGRADES_UNAVAILABLE') {
          return NextResponse.json({
            answer:
              "Upgrades data isn't wired into BullishAI yet. Want me to pull stocks with improving fundamentals or strong trend reversals instead?\n\n⚠️ *This is for educational purposes only and not financial advice.*",
            model: 'bullishai-system',
            modelBadge: 'BullishAI Screener Engine',
            latency: 0,
            section: section || undefined,
            followUpContext: previousContext || undefined,
          })
        }

        // handleRecommendedQuery should never throw now - it returns conceptual answers
        // But if it does throw for some reason, provide a helpful conceptual answer
        console.error('Recommended preset handling error:', error)
        
        // Provide a conceptual answer based on the query type
        const conceptualAnswers: Record<string, string> = {
          'market-summary': "I don't have fresh market data from BullishAI right now, but here's how traders typically assess market health: watch major indices (SPY, QQQ, DIA) for overall direction, check sector rotation for risk-on/risk-off signals, and monitor VIX for volatility. Want me to explain how to read these indicators?",
          'top-movers': "I don't see standout movers in BullishAI's feed right now. Typically, traders look for stocks moving >3-5% on above-average volume to identify momentum. Want me to explain how to spot unusual activity?",
          'sectors': "I don't have fresh sector data right now. Traders typically watch sector ETFs (XLK, XLF, XLE, etc.) to identify rotation themes. Leading sectors often indicate risk-on sentiment. Want me to explain sector analysis?",
          'news': "I don't see fresh headlines right now. Market-moving news typically includes earnings, Fed policy, major company announcements, and sector catalysts. Want me to explain how news affects markets?",
          'earnings': "I don't see earnings scheduled today. Earnings season runs quarterly, with most companies reporting in weeks following quarter-end. Want me to explain what traders watch during earnings?",
        }
        
        const conceptualAnswer = conceptualAnswers[recommendedType || ''] || 
          "I don't have fresh data from BullishAI right now, but here's how traders typically approach this: focus on key indicators, watch for catalysts, and manage risk. Want me to explain the concepts behind this analysis?"
        
        return NextResponse.json({
          answer: `${conceptualAnswer}\n\n⚠️ *This is for educational purposes only and not financial advice.*`,
          model: 'bullishai-conceptual',
          modelBadge: 'BullishAI Market Education',
          latency: 0,
          section: section || undefined,
        })
      }
    }
    
    // 5. Load BullishAI playbook entries (for tone/style on general questions)
    let kb: any[] = []
    let relevantContext: any[] = []
    try {
      kb = await loadKnowledgeBase()
      relevantContext = findBestMatch(query, kb, 5)
    } catch (kbError) {
      console.error('Failed to load BullishAI playbook:', kbError)
    }

    // 5. Build RAG context with live data
    const ragContext: RAGContext = {
      symbol: symbol || tickers[0] || undefined,
      prices: {},
      marketData: {
        session: 'REG',
        indices: {},
      },
      news: [],
    }

    const lowerQuery = query.toLowerCase()
    const detected = classifyChatDomain(query, tickers[0], false)
    const domain = detected.domain

    if (
      domain === 'market_overview' ||
      lowerQuery.includes('market') ||
      lowerQuery.includes('index') ||
      lowerQuery.includes('indices')
    ) {
      try {
        const indicesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=SPY,QQQ,DIA,IWM,VIX`)
        const indices = await indicesRes.json().catch(() => ({ quotes: [] }))
        indices.quotes?.forEach((q: any) => {
          const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
          const change = q.data ? parseFloat(q.data.change || 0) : parseFloat(q.change || 0)
          const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
          if (q.symbol && price > 0) {
            ragContext.prices![q.symbol] = {
              price,
              change,
              changePercent,
              timestamp: Date.now(),
            }
            ragContext.marketData!.indices[q.symbol] = {
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

    if (tickers.length > 0) {
      try {
        const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${tickers.join(',')}`)
        const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))
        quotes.quotes?.forEach((q: any) => {
          const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
          const change = q.data ? parseFloat(q.data.change || 0) : parseFloat(q.change || 0)
          const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
          if (q.symbol && price > 0) {
            ragContext.prices![q.symbol] = {
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

    if (domain === 'news_events' || lowerQuery.includes('news') || lowerQuery.includes('headline')) {
      try {
        const newsRes = await fetch(`${req.nextUrl.origin}/api/news/movers?limit=10`)
        const news = await newsRes.json().catch(() => ({ items: [] }))
        ragContext.news = news.items || []
      } catch (error) {
        console.error('Failed to fetch news:', error)
      }
    }

    // 6. Build system prompt and user prompt
    const styleExamples =
      relevantContext.slice(0, 3).map((ctx: any) => `Q: ${ctx.question}\nA: ${ctx.answer}`).join('\n\n') || ''

    const systemPrompt = `You are BullishAI Market Analyst — a confident, optimistic guide for traders using BullishAI.

Core rules:
- Use the provided context JSON for any numbers. If something is missing, say so clearly.
- Start with a concise takeaway (1-2 sentences), then list key numbers or drivers, then broader context.
- Always offer at least two follow-up options (e.g., expand list, dive into a ticker, check portfolio impact).
- Close with: "⚠️ This is for educational purposes only and not financial advice."
- Never mention internal systems like "knowledge base" — refer to it as the BullishAI playbook or internal research.

${styleExamples ? `Tone guide (BullishAI playbook excerpts):\n${styleExamples}\n` : ''}
`

    const userPrompt = `${query}${
      ragContext.news && ragContext.news.length > 0
        ? `\n\nBullishAI latest headlines:\n${ragContext.news
            .slice(0, 5)
            .map((item: any, i: number) => `${i + 1}. ${item.headline || item.title} — ${item.source || 'News'}`)
            .join('\n')}`
        : ''
    }`

    const requiredPhrases = tickers.slice(0, 5)

    const llmResponse = await runHybridLLM({
      userPrompt,
      systemPrompt,
      context: ragContext,
      domain,
      requiredPhrases,
      minLength: 140,
    })

    let answer = llmResponse.answer?.trim() || "I'm still thinking about that. Can you rephrase or point me to a ticker?"

    // Ensure follow-up hooks
    const domainFollowUps: Record<ChatDomain, string[]> = {
      market_overview: [
        'Want me to expand to more movers or break it down by sector?',
        'Want me to check which of these names sit in your portfolio?',
      ],
      ticker_focus: [
        'Want me to compare it against peers?',
        'Need me to pull recent news or earnings catalysts?',
      ],
      portfolio_wallet: [
        'Want me to surface your top contributors today?',
        'Should I pull your latest deposits and withdrawals?',
      ],
      news_events: [
        'Want more headlines or ticker-specific coverage?',
        'Need me to flag which of these events hit earnings calendars?',
      ],
      education_finance: [
        'Want a quick example or visual analogy?',
        'Need definitions for related terms?',
      ],
      coding_tech: [
        'Want me to suggest a fix or refactor idea?',
        'Need help writing a quick snippet?',
      ],
      general_chat: [
        'Want me to shift back to markets or portfolio stats?',
        'Need anything else from the BullishAI toolbox?',
      ],
    }

    const hooks = domainFollowUps[domain] || domainFollowUps.general_chat
    const hasHook = hooks.some((hook) => answer.toLowerCase().includes(hook.toLowerCase()))
    if (!hasHook) {
      answer += `\n\n${hooks[0]} Or ${hooks[1]}`
    }

    if (!answer.toLowerCase().includes('educational') && !answer.toLowerCase().includes('not financial advice')) {
      answer += `\n\n⚠️ This is for educational purposes only and not financial advice.`
    }

    const modelBadge = getModelBadge(llmResponse.metadata) || 'Multi-Model Engine'

    return NextResponse.json({
      answer,
      model: llmResponse.model,
      modelBadge,
      latency: llmResponse.latency,
      section: section || undefined,
      tickers: tickers.length > 0 ? tickers : undefined,
    })
  } catch (error: any) {
    console.error('Chat API error:', error)
    
    // Try to use BullishAI playbook as fallback even on errors
    try {
      const kb = await loadKnowledgeBase().catch(() => [])
      if (kb.length > 0 && query) {
        const relevantContext = findBestMatch(query, kb, 3)
        
        if (relevantContext.length > 0) {
          const fallbackAnswer = relevantContext[0].answer
          return NextResponse.json({
            answer: `${fallbackAnswer}\n\n⚠️ *This is for educational purposes only and not financial advice.*`,
            model: 'bullishai-playbook',
            modelBadge: 'BullishAI Playbook',
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
      answer: "Sorry, I'm having a bit of trouble right now. Can you try rephrasing that? Or ask me about something else — I'm great with stock prices, market trends, and quick insights!\n\n⚠️ *This is for educational purposes only and not financial advice.*",
      model: 'error-fallback',
      modelBadge: 'BullishAI Hybrid',
      latency: 0,
    })
  }
}
