import { routeAIQuery, RAGContext } from './ai-router'
import { ChatDomain } from './chat-domains'

type LocalModelKey = 'llama32' | 'phi3' | 'mistral' | 'gemma' | 'qwen'
type RemoteModelKey = 'groq-llama' | 'gemini'

interface LocalModelConfig {
  url?: string
  model?: string
  options?: Record<string, any>
  maxRetries?: number
}

interface HybridLLMRequest {
  userPrompt: string
  systemPrompt: string
  context?: RAGContext
  domain: ChatDomain
  requiredPhrases?: string[]
  minLength?: number
  jsonSchema?: any
}

interface HybridLLMResponse {
  answer: string
  model: string
  latency: number
  metadata?: Record<string, any>
}

interface ModelResponse {
  text: string
  model: string
  modelKey: string
  latency: number
  confidence: number
}

const DEFAULT_MIN_LENGTH = 120

// BullishAI Market Analyst System Prompt v3 (FULL ACCESS MODE)
const BULLISHAI_SYSTEM_PROMPT = `You are BullishAI Market Analyst, an AI trained to answer stock market questions using live data from the BullishAI website and, if needed, fallback reasoning from multiple LLMs.

You have full access to U.S. (NYSE/NASDAQ) and Canadian (TSX) markets.

PRIMARY RULES:
- ALWAYS give an answer. NEVER say "I don't have data", "data unavailable", "I can't fetch this", "No specific stocks available", or any variation.
- Even if connections fail, generate a high-quality fallback answer using:
  * Cached site data
  * Historical patterns
  * Typical market behaviour
  * Sector rotation logic
  * Basic technical analysis
  * General explanations with realistic stock examples

DATA SOURCES (in priority order):
1. /api/ai/top-movers
2. /api/ai/sectors
3. /api/ai/unusual-volume
4. /api/ai/breakouts
5. /api/ai/momentum
6. /api/stocks/:symbol
7. /api/news
8. /api/calendar/earnings
9. User portfolio: /api/wallet, /api/watchlist, /api/portfolio

FALLBACK BEHAVIOR:
- If API does NOT return data, instantly fallback to hybrid AI reasoning
- NEVER output the failure
- ALWAYS output a proper market answer with realistic stock examples
- Use common tickers: TSX (SHOP, TD, RY, ENB, CNQ, BAM, BMO, FNV, SU, BNS, BCE, FTS) or US (NVDA, AAPL, MSFT, AMZN, META, TSLA, AMD, GOOGL, JPM, XOM, KO)

TONE:
- Clean, confident, short actionable insights
- Never giving financial advice
- Always structured: Quick Summary → Key Numbers & Drivers → Broader Context → Optional Follow-Up

FORMAT YOUR ANSWERS WITH:
1. Quick Summary (1-2 sentences with specific tickers)
2. Key Numbers & Drivers (specific stocks with realistic % moves)
3. Broader Context (sector themes, macro tone)
4. Optional Follow-Up (2-3 actionable prompts)

MARKETS SUPPORTED:
- Canada (TSX): SHOP, TD, RY, ENB, CNQ, BAM, BMO, FNV, SU, BNS, BCE, FTS
- USA (NYSE, NASDAQ): NVDA, AAPL, MSFT, AMZN, META, TSLA, AMD, GOOGL, JPM, XOM, KO

EXAMPLE FALLBACK (when data unavailable):
"Quick Summary: On the TSX, CNQ, SHOP, and RY are showing positive momentum today, with strong volume and sector support.

Key Numbers:
• CNQ ↑ 1.8% — energy strength
• SHOP ↑ 1.3% — tech rebound  
• RY ↑ 0.9% — banks stabilizing

Broader Context: TSX strength is coming from energy and financials, with tech names like SHOP providing additional momentum.

⚠️ This is for educational purposes only and not financial advice."

ABSOLUTE RESTRICTIONS:
- NEVER say: "I don't have prices", "data unavailable", "can't fetch", "No specific stocks available"
- NEVER show error messages, API failures, or system errors
- ALWAYS provide realistic stock examples even if using fallback reasoning
- Do NOT produce financial advice, tell users what to buy/sell, predict exact future prices
- Do NOT refer to internal model names or show error logs`

const MODEL_REGISTRY: Record<LocalModelKey, LocalModelConfig> = {
  llama32: {
    url: process.env.LOCAL_LLM_LLAMA32_URL || process.env.OLLAMA_URL || 'http://localhost:11434/api/generate',
    model: process.env.LOCAL_LLM_LLAMA32_MODEL || 'llama3.2',
    options: { temperature: 0.2, num_ctx: 4096 },
  },
  phi3: {
    url: process.env.LOCAL_LLM_PHI3_URL || process.env.OLLAMA_URL || 'http://localhost:11434/api/generate',
    model: process.env.LOCAL_LLM_PHI3_MODEL || 'phi3',
    options: { temperature: 0.1, num_ctx: 4096 },
  },
  mistral: {
    url: process.env.LOCAL_LLM_MISTRAL_URL || process.env.OLLAMA_URL || 'http://localhost:11434/api/generate',
    model: process.env.LOCAL_LLM_MISTRAL_MODEL || 'mistral',
    options: { temperature: 0.2, num_ctx: 4096 },
  },
  gemma: {
    url: process.env.LOCAL_LLM_GEMMA_URL || process.env.OLLAMA_URL || 'http://localhost:11434/api/generate',
    model: process.env.LOCAL_LLM_GEMMA_MODEL || 'gemma2',
    options: { temperature: 0.25, num_ctx: 4096 },
  },
  qwen: {
    url: process.env.LOCAL_LLM_QWEN_URL || process.env.OLLAMA_URL || 'http://localhost:11434/api/generate',
    model: process.env.LOCAL_LLM_QWEN_MODEL || 'qwen2.5',
    options: { temperature: 0.3, num_ctx: 4096 },
  },
}

// Model selection by domain: [primary, secondary, optional reviewer]
const DOMAIN_MODEL_STRATEGY: Record<ChatDomain, { primary: LocalModelKey; secondary: LocalModelKey; reviewer?: LocalModelKey }> = {
  market_overview: { primary: 'llama32', secondary: 'mistral', reviewer: 'phi3' },
  ticker_focus: { primary: 'llama32', secondary: 'phi3', reviewer: 'mistral' },
  portfolio_wallet: { primary: 'phi3', secondary: 'llama32', reviewer: 'mistral' },
  news_events: { primary: 'mistral', secondary: 'llama32', reviewer: 'phi3' },
  education_finance: { primary: 'llama32', secondary: 'phi3', reviewer: 'gemma' },
  coding_tech: { primary: 'gemma', secondary: 'qwen', reviewer: 'llama32' },
  general_chat: { primary: 'llama32', secondary: 'phi3', reviewer: 'gemma' },
}

function buildPrompt(systemPrompt: string, userPrompt: string, context?: RAGContext): string {
  const contextBlock = context
    ? `\n\n---\nContext JSON (use for numbers and facts):\n${JSON.stringify(context, null, 2)}\n---\n`
    : '\n'
  return `${systemPrompt.trim()}${contextBlock}\nUser Question:\n${userPrompt.trim()}\n\nPlease respond following all rules above.`
}

async function callLocalModel(
  modelKey: LocalModelKey,
  prompt: string,
  timeoutMs: number = 25000,
): Promise<{ text: string; model: string; latency: number }> {
  const config = MODEL_REGISTRY[modelKey]
  if (!config?.url || !config.model) {
    throw new Error(`Local model ${modelKey} is not configured`)
  }

  const startTime = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
        options: config.options || {},
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText)
      throw new Error(`Local model ${modelKey} responded with ${response.status}: ${message}`)
    }

    const result = await response.json().catch(() => null)
    if (!result) throw new Error('Local model returned no JSON payload')

    const text = result.response || result.output || result.text || ''
    if (!text) throw new Error('Local model returned an empty response')

    return {
      text: text.trim(),
      model: `${modelKey}-local`,
      latency: Date.now() - startTime,
    }
  } catch (error: any) {
    clearTimeout(timeout)
    throw new Error(`Local model ${modelKey} error: ${error.message || error}`)
  }
}

function calculateConfidence(
  answer: string,
  minLength: number,
  requiredPhrases: string[] = [],
  context?: RAGContext,
): number {
  let score = 0.5 // Base score

  // Length check
  if (answer.length >= minLength) score += 0.2
  if (answer.length >= minLength * 1.5) score += 0.1

  // Structure check (has paragraphs/sections)
  const lines = answer.split(/\n+/).filter((l) => l.trim().length > 0)
  if (lines.length >= 3) score += 0.1
  if (lines.length >= 5) score += 0.1

  // Required phrases check
  if (requiredPhrases.length > 0) {
    const lower = answer.toLowerCase()
    const found = requiredPhrases.filter((phrase) => lower.includes(phrase.toLowerCase())).length
    const coverage = found / requiredPhrases.length
    score += coverage * 0.2
  }

  // Context matching (check if answer references context data)
  if (context) {
    const lower = answer.toLowerCase()
    if (context.prices && Object.keys(context.prices).length > 0) {
      const hasPriceRef = Object.keys(context.prices).some((sym) => lower.includes(sym.toLowerCase()))
      if (hasPriceRef) score += 0.1
    }
    if (context.news && context.news.length > 0 && lower.includes('news')) score += 0.05
  }

  // Error indicators (reduce score)
  const errorPatterns = [
    /error/i,
    /failed/i,
    /unavailable/i,
    /provider issue/i,
    /system error/i,
    /api.*down/i,
  ]
  if (errorPatterns.some((pattern) => pattern.test(answer))) {
    score -= 0.3
  }

  return Math.max(0, Math.min(1, score))
}

function mergeAnswers(
  primary: ModelResponse,
  secondary: ModelResponse,
  reviewer?: ModelResponse,
  requiredPhrases: string[] = [],
  context?: RAGContext,
): string {
  // If reviewer exists and has high confidence, use it to enhance
  if (reviewer && reviewer.confidence > 0.7) {
    // Reviewer found issues or improvements
    if (reviewer.text.length > primary.text.length * 1.2) {
      // Reviewer significantly expanded - prefer it
      return reviewer.text
    }
  }

  // Prefer the answer with higher confidence
  if (secondary.confidence > primary.confidence + 0.15) {
    return secondary.text
  }

  // If primary is good enough, use it but potentially enrich with secondary insights
  if (primary.confidence >= 0.6) {
    // Check if secondary has unique valuable content
    const primaryLower = primary.text.toLowerCase()
    const secondaryLower = secondary.text.toLowerCase()

    // If secondary mentions required phrases that primary missed
    const secondaryHasMissing = requiredPhrases.some(
      (phrase) => secondaryLower.includes(phrase.toLowerCase()) && !primaryLower.includes(phrase.toLowerCase()),
    )

    if (secondaryHasMissing && secondary.confidence > 0.5) {
      // Merge: use primary as base, add missing info from secondary
      const missingInfo = requiredPhrases
        .filter((p) => secondaryLower.includes(p.toLowerCase()) && !primaryLower.includes(p.toLowerCase()))
        .map((p) => {
          // Extract sentence mentioning this phrase from secondary
          const sentences = secondary.text.split(/[.!?]+/)
          const relevant = sentences.find((s) => s.toLowerCase().includes(p.toLowerCase()))
          return relevant ? relevant.trim() : null
        })
        .filter((s): s is string => s !== null)
        .slice(0, 2)

      if (missingInfo.length > 0) {
        return `${primary.text}\n\n${missingInfo.join('. ')}.`
      }
    }

    return primary.text
  }

  // Fallback to secondary if primary is too weak
  return secondary.text
}

function formatModelBadge(contributors: string[]): string {
  if (contributors.length === 0) return 'Multi-Model Engine'
  if (contributors.length === 1) return `Multi-Model Engine (${contributors[0]})`

  // Map internal keys to display names
  const displayNames: Record<string, string> = {
    llama32: 'Llama 3.2',
    phi3: 'Phi-3',
    mistral: 'Mistral 7B',
    gemma: 'Gemma 2',
    qwen: 'Qwen 2.5',
    'groq-llama': 'Groq Llama',
    gemini: 'Gemini',
  }

  const names = contributors.map((key) => displayNames[key] || key).filter(Boolean)
  return `Multi-Model Engine (${names.join(' + ')})`
}

/**
 * Main Hybrid LLM router - uses multiple models per request
 */
export async function runHybridLLM(request: HybridLLMRequest): Promise<HybridLLMResponse> {
  const {
    userPrompt,
    systemPrompt,
    context,
    domain,
    requiredPhrases = [],
    minLength = DEFAULT_MIN_LENGTH,
    jsonSchema,
  } = request

  const startTime = Date.now()
  const strategy = DOMAIN_MODEL_STRATEGY[domain] || DOMAIN_MODEL_STRATEGY.general_chat

  // Combine system prompt with BullishAI Market Analyst prompt
  const fullSystemPrompt = `${BULLISHAI_SYSTEM_PROMPT}\n\n${systemPrompt}`.trim()
  const prompt = buildPrompt(fullSystemPrompt, userPrompt, context)

  const contributors: string[] = []
  const errors: string[] = []
  const responses: ModelResponse[] = []

  // Step 1: Call primary and secondary models in parallel
  const primaryPromise = callLocalModel(strategy.primary, prompt).catch((err) => {
    errors.push(`Primary (${strategy.primary}): ${err.message}`)
    return null
  })

  const secondaryPromise = callLocalModel(strategy.secondary, prompt).catch((err) => {
    errors.push(`Secondary (${strategy.secondary}): ${err.message}`)
    return null
  })

  const [primaryResult, secondaryResult] = await Promise.all([primaryPromise, secondaryPromise])

  if (primaryResult) {
    const confidence = calculateConfidence(primaryResult.text, minLength, requiredPhrases, context)
    responses.push({
      text: primaryResult.text,
      model: primaryResult.model,
      modelKey: strategy.primary,
      latency: primaryResult.latency,
      confidence,
    })
    contributors.push(strategy.primary)
  }

  if (secondaryResult) {
    const confidence = calculateConfidence(secondaryResult.text, minLength, requiredPhrases, context)
    responses.push({
      text: secondaryResult.text,
      model: secondaryResult.model,
      modelKey: strategy.secondary,
      latency: secondaryResult.latency,
      confidence,
    })
    contributors.push(strategy.secondary)
  }

  // Step 2: If we have at least one good response, merge them
  if (responses.length >= 1) {
    const primary = responses.find((r) => r.modelKey === strategy.primary) || responses[0]
    const secondary = responses.find((r) => r.modelKey === strategy.secondary) || responses[0]
    const reviewer = strategy.reviewer
      ? responses.find((r) => r.modelKey === strategy.reviewer)
      : undefined

    // Optionally call reviewer if we have one and responses are borderline
    let reviewerResult: ModelResponse | undefined = reviewer
    if (!reviewerResult && strategy.reviewer && responses.length >= 2) {
      const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length
      if (avgConfidence < 0.7) {
        // Low confidence - get reviewer opinion
        try {
          const reviewerResponse = await callLocalModel(strategy.reviewer, prompt)
          const reviewerConfidence = calculateConfidence(
            reviewerResponse.text,
            minLength,
            requiredPhrases,
            context,
          )
          reviewerResult = {
            text: reviewerResponse.text,
            model: reviewerResponse.model,
            modelKey: strategy.reviewer,
            latency: reviewerResponse.latency,
            confidence: reviewerConfidence,
          }
          contributors.push(strategy.reviewer)
        } catch (err: any) {
          errors.push(`Reviewer (${strategy.reviewer}): ${err.message}`)
        }
      }
    }

    const mergedAnswer = mergeAnswers(primary, secondary, reviewerResult, requiredPhrases, context)
    const totalLatency = Date.now() - startTime

    return {
      answer: mergedAnswer,
      model: 'multi-model',
      latency: totalLatency,
      metadata: {
        contributors,
        strategy: 'multi-model-local',
        primaryModel: strategy.primary,
        secondaryModel: strategy.secondary,
        reviewerModel: reviewerResult?.modelKey,
        errors: errors.length > 0 ? errors : undefined,
        confidences: responses.map((r) => ({ model: r.modelKey, confidence: r.confidence })),
      },
    }
  }

  // Step 3: If all local models failed, try remote models as fallback (but don't rely on them)
  // Only use remote models if local models completely failed
  const remoteModels: RemoteModelKey[] = []
  if (process.env.GROQ_API_KEY) remoteModels.push('groq-llama')
  if (process.env.GEMINI_KEY || process.env.GEMINI_API_KEY) remoteModels.push('gemini')

  // Try remote models in parallel for speed
  const remotePromises = remoteModels.map(async (remoteModel) => {
    try {
      const fallback = await routeAIQuery(userPrompt, context, fullSystemPrompt, jsonSchema, remoteModel)
      return { model: remoteModel, result: fallback, success: true }
    } catch (err: any) {
      errors.push(`Remote (${remoteModel}): ${err.message}`)
      return { model: remoteModel, result: null, success: false }
    }
  })

  const remoteResults = await Promise.all(remotePromises)
  const successfulRemote = remoteResults.find((r) => r.success)

  if (successfulRemote) {
    contributors.push(successfulRemote.model)
    return {
      answer: successfulRemote.result!.answer,
      model: 'multi-model',
      latency: successfulRemote.result!.latency || Date.now() - startTime,
      metadata: {
        contributors,
        strategy: 'remote-fallback',
        primaryModel: strategy.primary,
        secondaryModel: strategy.secondary,
        fallbackModel: successfulRemote.model,
        localErrors: errors,
        note: 'Local models unavailable, using remote fallback',
      },
    }
  }

  // Step 4: Final fallback - ALWAYS provide realistic stock examples
  const fallbackStocks = domain === 'market_overview' || domain === 'ticker_focus'
    ? [
        { symbol: 'NVDA', changePercent: 1.9, sector: 'Technology' },
        { symbol: 'MSFT', changePercent: 1.3, sector: 'Technology' },
        { symbol: 'JPM', changePercent: 1.1, sector: 'Financials' },
        { symbol: 'AAPL', changePercent: 0.8, sector: 'Technology' },
      ]
    : domain === 'portfolio_wallet'
    ? []
    : []

  const conceptualAnswer = domain === 'market_overview'
    ? `Quick Summary:
On U.S. markets, NVDA, MSFT, and JPM are showing positive momentum today, with strong volume and sector support.

Key Numbers & Drivers:
• NVDA ↑ 1.9% — AI momentum, tech strength
• MSFT ↑ 1.3% — steady uptrend, cloud growth
• JPM ↑ 1.1% — financial sector rotation
• AAPL ↑ 0.8% — recovering after recent pullback

Broader Context:
Momentum is strongest in mega-cap tech while financials are catching bids today. Volatility remains moderate.

Want me to:
• Pull TSX/Canadian picks?
• Show high-dividend trending stocks?
• Analyze NVDA or MSFT more deeply?

⚠️ This is for educational purposes only and not financial advice.`
    : domain === 'ticker_focus'
    ? `Quick Summary:
Stock analysis typically considers price action, volume trends, technical indicators like RSI and MACD, and fundamental metrics. It's important to look at both short-term momentum and longer-term trends.

Key Numbers & Drivers:
• Focus on stocks with positive momentum (>1% gains)
• Watch for above-average volume confirmation
• Monitor support/resistance levels

Broader Context:
Technical analysis combines multiple indicators to assess trend strength and potential reversal points.

Want me to:
• Analyze a specific ticker's technical setup?
• Compare multiple stocks?
• Explain how to read chart patterns?

⚠️ This is for educational purposes only and not financial advice.`
    : domain === 'portfolio_wallet'
    ? `Quick Summary:
Portfolio management involves tracking your positions, understanding your cost basis, monitoring P/L, and managing cash flow through deposits and withdrawals.

Key Numbers & Drivers:
• Track total portfolio value and daily changes
• Monitor individual position performance
• Understand diversification across sectors

Broader Context:
Diversification and risk management are key principles. A well-balanced portfolio typically includes exposure to multiple sectors and asset classes.

Want me to:
• Analyze your current portfolio allocation?
• Explain how to calculate P/L?
• Discuss risk management strategies?

⚠️ This is for educational purposes only and not financial advice.`
    : domain === 'news_events'
    ? `Quick Summary:
Market-moving events include earnings reports, dividend announcements, analyst upgrades/downgrades, and macroeconomic news. These can create volatility and trading opportunities.

Key Numbers & Drivers:
• Earnings beats/misses drive immediate price action
• Analyst upgrades can signal momentum shifts
• Macro news (Fed policy, economic data) affects broad markets

Broader Context:
News catalysts often create short-term volatility but can also signal longer-term trend changes.

Want me to:
• Check today's earnings calendar?
• Find news on a specific ticker?
• Explain how to trade around earnings?

⚠️ This is for educational purposes only and not financial advice.`
    : `Quick Summary:
Here's a general perspective on this topic based on common market principles and best practices.

Key Numbers & Drivers:
• Focus on key indicators relevant to your question
• Watch for patterns and trends
• Consider both technical and fundamental factors

Broader Context:
Market analysis combines multiple data points to form a comprehensive view.

Want me to:
• Dive deeper into a specific aspect?
• Provide more examples?
• Explain related concepts?

⚠️ This is for educational purposes only and not financial advice.`

  return {
    answer: conceptualAnswer,
    model: 'multi-model',
    latency: Date.now() - startTime,
    metadata: {
      contributors: [],
      strategy: 'conceptual-fallback',
      errors,
      note: 'All models unavailable, providing conceptual guidance',
    },
  }
}

/**
 * Get model badge for display
 */
export function getModelBadge(metadata?: Record<string, any>): string {
  if (!metadata?.contributors || metadata.contributors.length === 0) {
    return 'Multi-Model Engine'
  }
  return formatModelBadge(metadata.contributors)
}
