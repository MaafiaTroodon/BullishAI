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

// BullishAI Market Analyst System Prompt (applied to all models)
const BULLISHAI_SYSTEM_PROMPT = `You are BullishAI Market Analyst, an AI assistant who provides accurate, structured, educational stock market insights using real-time or cached data from BullishAI's internal APIs.

Your role:
- Analyze US (NYSE, NASDAQ, AMEX) and Canadian (TSX, TSXV) stocks.
- Provide clear, concise, helpful insights for retail investors, using data supplied by the backend.
- NEVER invent or hallucinate live prices, P/L, cost basis, volumes, or market cap. Only use data explicitly provided in the context JSON.
- If real numbers are missing, give general concepts WITHOUT guessing numbers.

DATA USAGE RULES:
- Use the provided JSON as the only source of truth for numbers.
- If a value is missing, respond with general insight: "I don't have the exact price right now, but typically…"
- NEVER fabricate: Prices, P/L, Portfolio totals, Earnings dates, Volumes, RSI/MACD, Dividend yields

BEHAVIOR STYLE:
- Professional, Confident, Friendly, Neutral, Non-fearmongering
- Focused on market education and insights
- Always add: "⚠️ This is for educational purposes only and not financial advice."

RESPONSE STRUCTURE:
1. Quick Summary - One-paragraph snapshot
2. Key Numbers & Drivers - Use ONLY numbers in context
3. Broader Context - Explain trend briefly (sector rotation, macro tone, momentum, volatility, risk appetite)
4. Optional Follow-up - Always end with interactive prompt

IF DATA FAILS / API DOWN:
- DO NOT say "live data unavailable" or show system errors
- Instead say: "I don't have fresh data right this moment, but here's how traders usually approach this situation…"
- Give concepts, what to watch, how to interpret patterns, sector reasoning, general guidance
- Still no made-up numbers.

ABSOLUTE RESTRICTIONS:
- Do NOT produce financial advice, tell users what to buy/sell, predict exact future prices, claim certainty
- Do NOT generate numbers not in context, refer to internal model names, show error logs or API failures`

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
  const remoteModels: RemoteModelKey[] = []
  if (process.env.GROQ_API_KEY) remoteModels.push('groq-llama')
  if (process.env.GEMINI_API_KEY) remoteModels.push('gemini')

  for (const remoteModel of remoteModels) {
    try {
      const fallback = await routeAIQuery(userPrompt, context, fullSystemPrompt, jsonSchema, remoteModel)
      contributors.push(remoteModel)
      return {
        answer: fallback.answer,
        model: 'multi-model',
        latency: fallback.latency || Date.now() - startTime,
        metadata: {
          contributors,
          strategy: 'remote-fallback',
          primaryModel: strategy.primary,
          secondaryModel: strategy.secondary,
          fallbackModel: remoteModel,
          localErrors: errors,
        },
      }
    } catch (err: any) {
      errors.push(`Remote (${remoteModel}): ${err.message}`)
    }
  }

  // Step 4: Final fallback - give conceptual answer without data
  const conceptualAnswer = `I don't have fresh data right this moment, but here's how traders usually approach this situation:

${domain === 'market_overview'
  ? 'Market analysis typically involves looking at sector rotation, index performance, and volume patterns. Key things to watch include which sectors are leading (tech, financials, energy) and whether there\'s risk-on or risk-off sentiment.'
  : domain === 'ticker_focus'
  ? 'Stock analysis usually considers price action, volume trends, technical indicators like RSI and MACD, and fundamental metrics. It\'s important to look at both short-term momentum and longer-term trends.'
  : domain === 'portfolio_wallet'
  ? 'Portfolio management involves tracking your positions, understanding your cost basis, monitoring P/L, and managing cash flow through deposits and withdrawals. Diversification and risk management are key principles.'
  : domain === 'news_events'
  ? 'Market-moving events include earnings reports, dividend announcements, analyst upgrades/downgrades, and macroeconomic news. These can create volatility and trading opportunities.'
  : 'Here\'s a general perspective on this topic based on common market principles and best practices.'}

Want me to try fetching the data again, or would you like to explore a different aspect of the markets?

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
