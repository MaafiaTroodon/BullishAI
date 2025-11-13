/**
 * AI Model Router
 * Routes requests to appropriate AI model based on query type and requirements
 */

import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

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
async function callGroq(
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
    const response = await groq.chat.completions.create({
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
    throw new Error(`Gemini API failed: ${error.message}`)
  }
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
    // If Groq fails (rate limit, etc.), fallback to Gemini
    if (model === 'groq-llama' || (model === 'local-pytorch' && error.message?.includes('Groq'))) {
      if (error.isRecoverable || error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('429')) {
        console.warn(`Groq rate limit or error detected, falling back to Gemini:`, error.message)
        try {
          return await callGemini(query, context, systemPrompt, jsonSchema)
        } catch (geminiError: any) {
          console.error('Gemini fallback also failed:', geminiError)
          throw new Error(`Both Groq and Gemini failed. Groq: ${error.message}. Gemini: ${geminiError.message}`)
        }
      }
    }
    
    // For other models, fallback to Groq first, then Gemini
    if (model !== 'groq-llama' && model !== 'gemini') {
      console.warn(`Model ${model} failed, falling back to Groq:`, error)
      try {
        return await callGroq(query, context, systemPrompt, jsonSchema)
      } catch (groqError: any) {
        // If Groq also fails, try Gemini
        if (groqError.isRecoverable || groqError.status === 429) {
          console.warn('Groq fallback failed, trying Gemini:', groqError.message)
          return await callGemini(query, context, systemPrompt, jsonSchema)
        }
        throw groqError
      }
    }
    
    // If Gemini fails and we're already on Gemini, or if it's a non-recoverable error
    throw error
  }
}

