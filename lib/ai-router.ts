/**
 * AI Model Router
 * Routes requests to appropriate AI model based on query type and requirements
 */

import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

const primaryGroqKey = process.env.GROQ_API_KEY
const secondaryGroqKey = process.env.GROQ_API_KEY_SECONDARY

const groqPrimary = primaryGroqKey ? new Groq({ apiKey: primaryGroqKey }) : null
const groqSecondary = secondaryGroqKey ? new Groq({ apiKey: secondaryGroqKey }) : null

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export type AIModel = 'groq-llama' | 'gemini' | 'local-pytorch'

export interface RAGContext {
  symbol?: string
  prices?: Record<string, { price: number; change: number; changePercent: number; timestamp: number }>
  fundamentals?: Record<string, any>
  news?: Array<{ headline: string; summary: string; source: string; datetime: number }>
  holdings?: Array<{ symbol: string; shares: number; avgPrice: number }>
  marketData?: {
    session: string
    indices: Record<string, { value: number; change: number; changePercent: number }>
  }
  lists?: {
    gainers?: Array<{ symbol: string; name?: string; price: number; changePercent: number; sector?: string; volume?: number }>
    losers?: Array<{ symbol: string; name?: string; price: number; changePercent: number; sector?: string; volume?: number }>
    sectors?: Array<{ name: string; symbol: string; changePercent: number; change: number; strength: number }>
    unusualVolume?: Array<{ symbol: string; name?: string; price: number; changePercent: number; volume: number; avgVolume: number; relativeVolume: number; sector?: string }>
    screener?: Array<any>
  }
  calendar?: {
    earnings?: Array<{ symbol: string; name?: string; time?: string; estimate?: number }>
    dividends?: Array<any>
  }
}

export interface AIResponse {
  answer: string
  model: AIModel
  latency: number
  citations?: Array<{ source: string; timestamp: number }>
  riskNote?: string
  metadata?: Record<string, any>
}

const SAFETY_DISCLAIMER = '\n\n⚠️ Not financial advice. Past performance does not guarantee future results. Always do your own research and consult with a financial advisor.'

/**
 * Route query to appropriate model based on content
 * Can be overridden by caller
 */
export function selectModel(query: string, context?: RAGContext, preferredModel?: AIModel): AIModel {
  // If caller specifies a model, use it
  if (preferredModel) {
    return preferredModel
  }
  
  const lowerQuery = query.toLowerCase()
  
  // Route to Gemini for PDF/filings/tables
  if (lowerQuery.includes('pdf') || lowerQuery.includes('filing') || lowerQuery.includes('sec') || 
      lowerQuery.includes('table') || lowerQuery.includes('financial statement')) {
    return 'gemini'
  }
  
  // Route to Local PyTorch for domain-specific finance Q&A (if available)
  if (lowerQuery.includes('screening') || lowerQuery.includes('rationale') || 
      lowerQuery.includes('explain') && context?.fundamentals) {
    // Check if local model is available
    if (process.env.LOCAL_PYTORCH_ENABLED === 'true') {
      return 'local-pytorch'
    }
  }
  
  // Default to Groq for quick insights, intraday, recommendations
  return 'groq-llama'
}

/**
 * Format RAG context for prompt injection
 */
export function formatRAGContext(context: RAGContext): string {
  const parts: string[] = []
  
  if (context.symbol) {
    parts.push(`Current Symbol: ${context.symbol}`)
  }
  
  if (context.prices) {
    parts.push('\nCurrent Prices:')
    Object.entries(context.prices).forEach(([symbol, data]) => {
      parts.push(`  ${symbol}: $${data.price.toFixed(2)} (${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)`)
    })
  }
  
  if (context.fundamentals) {
    parts.push('\nFundamentals:')
    Object.entries(context.fundamentals).forEach(([key, value]) => {
      parts.push(`  ${key}: ${JSON.stringify(value)}`)
    })
  }
  
  if (context.news && context.news.length > 0) {
    parts.push('\nRecent News:')
    context.news.slice(0, 5).forEach((item, idx) => {
      parts.push(`  ${idx + 1}. ${item.headline} (${item.source})`)
      if (item.summary) parts.push(`     ${item.summary}`)
    })
  }
  
  if (context.holdings && context.holdings.length > 0) {
    parts.push('\nPortfolio Holdings:')
    context.holdings.forEach(h => {
      parts.push(`  ${h.symbol}: ${h.shares} shares @ $${h.avgPrice.toFixed(2)}`)
    })
  }
  
  return parts.join('\n')
}

/**
 * Check if error is a rate limit or recoverable error
 */
function isRecoverableError(error: any): boolean {
  if (!error) return false
  
  // Check for rate limit (429)
  if (error.status === 429 || error.statusCode === 429) return true
  
  // Check error message for rate limit indicators
  const message = error.message || error.error?.message || ''
  if (message.includes('rate limit') || message.includes('Rate limit') || 
      message.includes('429') || message.includes('quota') || message.includes('Quota')) {
    return true
  }
  
  return false
}

/**
 * Call Groq Llama-3 model
 */
async function callGroqClient(
  client: Groq,
  query: string,
  context: RAGContext,
  systemPrompt?: string,
  jsonSchema?: any
): Promise<AIResponse> {
  const startTime = Date.now()
  
  const defaultSystemPrompt = `You are a financial analysis AI assistant. 
Use ONLY the provided context for numbers and facts. Never guess or hallucinate numbers.
If a number is not in the context, say "I don't have that information."
Always include a one-line risk note at the end.
${SAFETY_DISCLAIMER}`

  const ragContext = formatRAGContext(context)
  // When using json_object format, the prompt must contain the word "json"
  const jsonHint = jsonSchema ? '\n\nIMPORTANT: Respond in valid JSON format only.' : ''
  const fullPrompt = `${ragContext}${jsonHint}\n\nUser Question: ${query}`
  
  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: (systemPrompt || defaultSystemPrompt) + (jsonSchema ? ' Respond in valid JSON format only.' : '') },
        { role: 'user', content: fullPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1000,
      response_format: jsonSchema ? { type: 'json_object' } : undefined,
    })
    
    const latency = Date.now() - startTime
    const answer = response.choices[0]?.message?.content || 'Unable to generate response'
    
    return {
      answer,
      model: 'groq-llama',
      latency,
      riskNote: 'Market conditions can change rapidly. Always verify current data.',
    }
  } catch (error: any) {
    console.error('Groq API error:', error)
    
    // Create error with recoverable flag
    const groqError: any = new Error(`Groq API failed: ${error.message || JSON.stringify(error.error || error)}`)
    groqError.status = error.status || error.statusCode
    groqError.isRecoverable = isRecoverableError(error)
    groqError.originalError = error
    
    throw groqError
  }
}

async function callGroq(
  query: string,
  context: RAGContext,
  systemPrompt?: string,
  jsonSchema?: any
): Promise<AIResponse> {
  if (groqPrimary) {
    try {
      return await callGroqClient(groqPrimary, query, context, systemPrompt, jsonSchema)
    } catch (error: any) {
      const status = error.status || error.statusCode
      const message = String(error.message || '')
      const shouldTrySecondary =
        !!groqSecondary &&
        (status === 401 ||
          status === 403 ||
          status === 429 ||
          message.toLowerCase().includes('invalid') ||
          message.toLowerCase().includes('unauthorized'))

      if (shouldTrySecondary) {
        return await callGroqClient(groqSecondary as Groq, query, context, systemPrompt, jsonSchema)
      }
      throw error
    }
  }

  if (groqSecondary) {
    return await callGroqClient(groqSecondary, query, context, systemPrompt, jsonSchema)
  }

  throw new Error('Groq API key missing')
}

/**
 * Call Google Gemini model
 */
async function callGemini(
  query: string,
  context: RAGContext,
  systemPrompt?: string,
  jsonSchema?: any
): Promise<AIResponse> {
  const startTime = Date.now()

  if (!process.env.GEMINI_API_KEY) {
    return {
      answer: buildContextFallbackAnswer(context),
      model: 'gemini',
      latency: Date.now() - startTime,
      riskNote: 'Service unavailable. Please verify information independently.',
      metadata: { fallback: true, reason: 'missing_api_key' },
    }
  }
  
  const defaultSystemPrompt = `You are a financial analysis AI assistant.
Use ONLY the provided context for numbers and facts. Never guess or hallucinate numbers.
If a number is not in the context, say "I don't have that information."
Always include a one-line risk note at the end.
${SAFETY_DISCLAIMER}`

  const ragContext = formatRAGContext(context)
  
  // Add JSON format instruction if schema is provided
  const jsonInstruction = jsonSchema 
    ? '\n\nIMPORTANT: You must respond with valid JSON format only. Ensure your response is a valid JSON object that can be parsed.'
    : ''
  
  const fullPrompt = `${ragContext}${jsonInstruction}\n\nUser Question: ${query}`
  
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: (systemPrompt || defaultSystemPrompt) + (jsonSchema ? ' Respond in valid JSON format only.' : ''),
    })
    
    // If JSON schema is required, add generation config
    const generationConfig: any = {
      temperature: 0.2,
      maxOutputTokens: 1000,
    }
    
    if (jsonSchema) {
      generationConfig.responseMimeType = 'application/json'
    }
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig,
    })
    
    const response = await result.response
    const answer = response.text()
    const latency = Date.now() - startTime
    
    return {
      answer,
      model: 'gemini',
      latency,
      riskNote: 'Analysis is based on provided materials. Verify current market data.',
    }
  } catch (error: any) {
    console.error('Gemini API error:', error)
    // Never throw from Gemini - always return a graceful fallback response
    const latency = Date.now() - startTime
    return {
      answer: buildContextFallbackAnswer(context),
      model: 'gemini',
      latency,
      riskNote: 'Service temporarily unavailable. Please verify information independently.',
      metadata: { error: error.message, fallback: true },
    }
  }
}

function buildContextFallbackAnswer(context: RAGContext): string {
  if (context.prices && Object.keys(context.prices).length > 0) {
    const priceLines = Object.entries(context.prices)
      .map(([symbol, data]) => `• ${symbol}: $${data.price.toFixed(2)} (${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)`)
      .join('\n')
    return `Quick Summary: Here’s a snapshot from the latest available pricing context.\n\nKey Numbers:\n${priceLines}\n\nBroader Context: If you want a deeper breakdown, ask about a specific ticker or sector and I’ll focus the analysis there.\n\n⚠️ This is for educational purposes only and not financial advice.`
  }

  if (context.news && context.news.length > 0) {
    const headlines = context.news
      .slice(0, 3)
      .map((item) => `• ${item.headline} (${item.source})`)
      .join('\n')
    return `Quick Summary: Here are the latest notable headlines.\n\nRecent News:\n${headlines}\n\nWant me to analyze a ticker or sector based on these catalysts?\n\n⚠️ This is for educational purposes only and not financial advice.`
  }

  return `Quick Summary: I’m ready to help with market insights. Ask about a ticker (like AAPL or NVDA), a sector, or a trading theme.\n\nOptional Follow-Up:\n• “What’s the outlook for big tech?”\n• “Show me momentum leaders today.”\n• “Analyze TSX banks.”\n\n⚠️ This is for educational purposes only and not financial advice.`
}

/**
 * Call Local PyTorch model (calls inference server)
 */
async function callLocalPyTorch(
  query: string,
  context: RAGContext,
  systemPrompt?: string
): Promise<AIResponse> {
  const startTime = Date.now()
  
  const inferenceServerUrl = process.env.LOCAL_PYTORCH_URL || 'http://localhost:8000'
  const ragContext = formatRAGContext(context)
  
  try {
    const response = await fetch(`${inferenceServerUrl}/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: query,
        context: ragContext,
        max_length: 512,
        temperature: 0.2,
        top_k: 50,
        top_p: 0.9,
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    })
    
    if (!response.ok) {
      throw new Error(`Inference server error: ${response.statusText}`)
    }
    
    const data = await response.json()
    const latency = Date.now() - startTime
    
    return {
      answer: data.answer || 'Unable to generate response',
      model: 'local-pytorch',
      latency,
      riskNote: 'Analysis from fine-tuned model. Always verify with current market data.',
      metadata: {
        confidence: data.confidence,
        model_version: data.model_version,
      },
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('Local PyTorch model timeout, falling back to Groq')
    } else {
      console.warn('Local PyTorch model unavailable, falling back to Groq:', error.message)
    }
    // Fallback to Groq
    return await callGroq(query, context, systemPrompt)
  }
}

/**
 * Main router function with automatic fallback
 */
export async function routeAIQuery(
  query: string,
  context: RAGContext = {},
  systemPrompt?: string,
  jsonSchema?: any,
  preferredModel?: AIModel
): Promise<AIResponse> {
  const model = selectModel(query, context, preferredModel)
  
  try {
    switch (model) {
      case 'groq-llama':
        return await callGroq(query, context, systemPrompt, jsonSchema)
      case 'gemini':
        return await callGemini(query, context, systemPrompt, jsonSchema)
      case 'local-pytorch':
        return await callLocalPyTorch(query, context, systemPrompt)
      default:
        return await callGroq(query, context, systemPrompt, jsonSchema)
    }
  } catch (error: any) {
    // If Groq fails (rate limit, etc.), ALWAYS fallback to Gemini
    if (model === 'groq-llama' || (model === 'local-pytorch' && error.message?.includes('Groq'))) {
      // Always fallback to Gemini for any Groq error - Gemini never throws
      console.warn(`Groq error detected, falling back to Gemini:`, error.message)
      const geminiResponse = await callGemini(query, context, systemPrompt, jsonSchema)
      // Add metadata to indicate this was a fallback
      return {
        ...geminiResponse,
        metadata: {
          ...geminiResponse.metadata,
          originalModel: 'groq-llama',
          fallbackReason: error.message,
          fallback: true
        }
      }
    }
    
    // For other models (local-pytorch), fallback to Groq first, then always to Gemini (which never throws)
    if (model === 'local-pytorch') {
      console.warn(`Model ${model} failed, falling back to Groq:`, error)
      try {
        return await callGroq(query, context, systemPrompt, jsonSchema)
      } catch (groqError: any) {
        // If Groq also fails, always use Gemini as final fallback (never throws)
        console.warn('Groq fallback failed, using Gemini as final fallback:', groqError.message)
        const geminiResponse = await callGemini(query, context, systemPrompt, jsonSchema)
        return {
          ...geminiResponse,
          metadata: {
            ...geminiResponse.metadata,
            originalModel: model,
            fallbackReason: `${error.message}; ${groqError.message}`,
            fallback: true
          }
        }
      }
    }
    
    // If we're already on Gemini and it "failed", it still returned a response (never throws)
    // But if somehow we get here, return a graceful fallback
    if (model === 'gemini') {
      const latency = Date.now()
      return {
        answer: `I encountered an issue processing your request. Based on the available context:\n\n${formatRAGContext(context)}\n\nPlease try rephrasing your question or try again in a moment.`,
        model: 'gemini',
        latency: 0,
        riskNote: 'Service issue encountered. Please verify information independently.',
        metadata: { error: error.message, fallback: true }
      }
    }
    
    // Last resort: return a helpful error message instead of throwing
    const latency = Date.now()
    return {
      answer: `I'm experiencing technical difficulties. Here's what I know from the available context:\n\n${formatRAGContext(context)}\n\nError: ${error.message || 'Unknown error'}\n\nPlease try again or contact support.`,
      model: model || 'unknown',
      latency: 0,
      riskNote: 'Service unavailable. Please verify information independently.',
      metadata: { error: error.message, fallback: true, critical: true }
    }
  }
}
