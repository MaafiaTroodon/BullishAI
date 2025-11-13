import { routeAIQuery, RAGContext } from './ai-router'
import { ChatDomain } from './chat-domains'

type LocalModelKey = 'llama32' | 'phi3' | 'mistral' | 'gemma' | 'qwen'

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

const DEFAULT_MIN_LENGTH = 120

const MODEL_REGISTRY: Record<LocalModelKey, LocalModelConfig> = {
  llama32: {
    url: process.env.LOCAL_LLM_LLAMA32_URL || process.env.Ollama_URL || 'http://localhost:11434/api/generate',
    model: process.env.LOCAL_LLM_LLAMA32_MODEL || 'llama3.2',
    options: { temperature: 0.2, num_ctx: 4096 },
  },
  phi3: {
    url: process.env.LOCAL_LLM_PHI3_URL || 'http://localhost:11434/api/generate',
    model: process.env.LOCAL_LLM_PHI3_MODEL || 'phi3',
    options: { temperature: 0.1, num_ctx: 4096 },
  },
  mistral: {
    url: process.env.LOCAL_LLM_MISTRAL_URL || 'http://localhost:11434/api/generate',
    model: process.env.LOCAL_LLM_MISTRAL_MODEL || 'mistral',
    options: { temperature: 0.2, num_ctx: 4096 },
  },
  gemma: {
    url: process.env.LOCAL_LLM_GEMMA_URL || 'http://localhost:11434/api/generate',
    model: process.env.LOCAL_LLM_GEMMA_MODEL || 'gemma2',
    options: { temperature: 0.25, num_ctx: 4096 },
  },
  qwen: {
    url: process.env.LOCAL_LLM_QWEN_URL || 'http://localhost:11434/api/generate',
    model: process.env.LOCAL_LLM_QWEN_MODEL || 'qwen2.5',
    options: { temperature: 0.3, num_ctx: 4096 },
  },
}

const DOMAIN_MODEL_PRIORITY: Record<ChatDomain, LocalModelKey[]> = {
  market_overview: ['llama32', 'mistral', 'phi3'],
  ticker_focus: ['llama32', 'phi3', 'mistral'],
  portfolio_wallet: ['phi3', 'llama32', 'mistral'],
  news_events: ['mistral', 'llama32', 'phi3'],
  education_finance: ['llama32', 'phi3', 'mistral'],
  coding_tech: ['gemma', 'qwen', 'llama32'],
  general_chat: ['llama32', 'phi3', 'gemma'],
}

function buildPrompt(systemPrompt: string, userPrompt: string, context?: RAGContext): string {
  const contextBlock = context ? `\n\n---\nContext JSON (use for numbers and facts):\n${JSON.stringify(context, null, 2)}\n---\n` : '\n'
  return `${systemPrompt.trim()}${contextBlock}\nUser Question:\n${userPrompt.trim()}\n\nPlease respond following all rules above.`
}

async function callLocalModel(modelKey: LocalModelKey, prompt: string): Promise<{ text: string; model: string }> {
  const config = MODEL_REGISTRY[modelKey]
  if (!config?.url || !config.model) {
    throw new Error(`Local model ${modelKey} is not configured`)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)

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

    return { text: text.trim(), model: `${modelKey}-local` }
  } catch (error: any) {
    clearTimeout(timeout)
    throw new Error(`Local model ${modelKey} error: ${error.message || error}`)
  }
}

function isLowConfidenceAnswer(answer: string, minLength: number, requiredPhrases: string[] = []): boolean {
  if (!answer || answer.trim().length < Math.max(80, minLength)) return true

  const lower = answer.toLowerCase()
  if (answer.split(/\n+/).length < 3 && answer.length < minLength + 40) {
    return true
  }

  // Ensure the answer references required phrases (symbols, data sources, etc.)
  if (requiredPhrases.length > 0) {
    const missing = requiredPhrases.filter((phrase) => !lower.includes(phrase.toLowerCase()))
    if (missing.length > Math.max(0, requiredPhrases.length - 2)) {
      return true
    }
  }

  return false
}

/**
 * Main Hybrid LLM router
 */
export async function runHybridLLM(request: HybridLLMRequest): Promise<HybridLLMResponse> {
  const { userPrompt, systemPrompt, context, domain, requiredPhrases = [], minLength = DEFAULT_MIN_LENGTH, jsonSchema } = request

  const startTime = Date.now()
  const prompt = buildPrompt(systemPrompt, userPrompt, context)
  const modelCandidates = DOMAIN_MODEL_PRIORITY[domain] || DOMAIN_MODEL_PRIORITY.general_chat
  const errors: string[] = []

  for (const modelKey of modelCandidates) {
    try {
      const { text, model } = await callLocalModel(modelKey, prompt)
      const latency = Date.now() - startTime

      if (isLowConfidenceAnswer(text, minLength, requiredPhrases)) {
        errors.push(`Model ${modelKey} response flagged as low confidence`)
        continue
      }

      return {
        answer: text,
        model,
        latency,
        metadata: { engine: modelKey, strategy: 'local-primary', errors },
      }
    } catch (error: any) {
      errors.push(error.message || String(error))
    }
  }

  // Fallback to hosted models (Groq/Gemini) using existing router
  try {
    const fallback = await routeAIQuery(userPrompt, context, systemPrompt, jsonSchema, 'groq-llama')
    return {
      answer: fallback.answer,
      model: fallback.model || 'groq-llama',
      latency: fallback.latency || Date.now() - startTime,
      metadata: { engine: 'groq-llama', strategy: 'hosted-fallback', localErrors: errors },
    }
  } catch (groqError: any) {
    errors.push(`Groq fallback failed: ${groqError.message}`)
  }

  // Final fallback to Gemini which never throws
  const finalFallback = await routeAIQuery(userPrompt, context, systemPrompt, jsonSchema, 'gemini')
  return {
    answer: finalFallback.answer,
    model: finalFallback.model || 'gemini',
    latency: finalFallback.latency || Date.now() - startTime,
    metadata: { engine: 'gemini', strategy: 'gemini-final', localErrors: errors },
  }
}


