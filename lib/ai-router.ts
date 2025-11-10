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
 */
export function selectModel(query: string, context?: RAGContext): AIModel {
  const lowerQuery = query.toLowerCase()
  
  // Route to Gemini for PDF/filings/tables
  if (lowerQuery.includes('pdf') || lowerQuery.includes('filing') || lowerQuery.includes('sec') || 
      lowerQuery.includes('table') || lowerQuery.includes('financial statement')) {
    return 'gemini'
  }
  
  // Route to Local PyTorch for domain-specific finance Q&A (if available)
  // For now, fallback to Groq until local model is trained
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
  const fullPrompt = `${ragContext}\n\nUser Question: ${query}`
  
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt || defaultSystemPrompt },
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
    throw new Error(`Groq API failed: ${error.message}`)
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
  
  const defaultSystemPrompt = `You are a financial analysis AI assistant specializing in document analysis.
Use ONLY the provided context for numbers and facts. Never guess or hallucinate numbers.
If a number is not in the context, say "I don't have that information."
Always include a one-line risk note at the end.
${SAFETY_DISCLAIMER}`

  const ragContext = formatRAGContext(context)
  const fullPrompt = `${ragContext}\n\nUser Question: ${query}`
  
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt || defaultSystemPrompt,
    })
    
    const result = await model.generateContent(fullPrompt)
    const response = await result.response
    const answer = response.text()
    const latency = Date.now() - startTime
    
    return {
      answer,
      model: 'gemini',
      latency,
      riskNote: 'Document analysis is based on provided materials. Verify current filings.',
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
      }),
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
    }
  } catch (error: any) {
    console.warn('Local PyTorch model unavailable, falling back to Groq:', error.message)
    // Fallback to Groq
    return await callGroq(query, context, systemPrompt)
  }
}

/**
 * Main router function
 */
export async function routeAIQuery(
  query: string,
  context: RAGContext = {},
  systemPrompt?: string,
  jsonSchema?: any
): Promise<AIResponse> {
  const model = selectModel(query, context)
  
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
    // Fallback to Groq on any error
    if (model !== 'groq-llama') {
      console.warn(`Model ${model} failed, falling back to Groq:`, error)
      return await callGroq(query, context, systemPrompt, jsonSchema)
    }
    throw error
  }
}

