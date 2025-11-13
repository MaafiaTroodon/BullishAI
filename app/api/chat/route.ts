import { NextRequest, NextResponse } from 'next/server'
import { RAGContext } from '@/lib/ai-router'
import { detectSection, extractTickers, loadKnowledgeBase } from '@/lib/chat-knowledge-base'
import { findBestMatch } from '@/lib/ai-knowledge-trainer'
import { getSession } from '@/lib/auth-server'
import { classifyChatDomain } from '@/lib/chat-domains'
import { runHybridLLM, getModelBadge } from '@/lib/hybrid-llm-router'
import { handleRecommendedQuery, FollowUpContext, RecommendedType } from '@/lib/chat-recommended'
import { isRecommendedQuestion } from '@/lib/chat-data-fetchers'

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
    const previousContext: FollowUpContext | null =
      body.previousContext && typeof body.previousContext === 'object' ? body.previousContext : null

    // 1. Determine if this is a recommended preset question
    const recommendedCheck = isRecommendedQuestion(query)
    let recommendedType: RecommendedType | null = null
    if (followUp && previousContext?.type) {
      recommendedType = previousContext.type
    } else if (presetId && PRESET_TYPE_MAP[presetId]) {
      recommendedType = PRESET_TYPE_MAP[presetId]
    } else if (recommendedCheck.needsLiveData && recommendedCheck.type) {
      recommendedType = recommendedCheck.type as RecommendedType
    }

    // 2. Detect section/intent
    const section = detectSection(query)
    const tickers = extractTickers(query) || (symbol ? [symbol.toUpperCase()] : [])

    // 3. Handle recommended presets with live data before knowledge base logic
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
    
    // 4. Load BullishAI playbook entries (for tone/style on general questions)
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

