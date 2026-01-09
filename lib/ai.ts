import Groq from 'groq-sdk'

const groqKeys = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_SECONDARY,
  process.env.GROQ_API_KEY_THIRD,
  process.env.GROQ_API_KEY_FOURTH,
].filter(Boolean) as string[]
const groqClients = groqKeys.map((key) => new Groq({ apiKey: key }))
let groqIndex = 0

async function callGroqCompletion(params: Groq.Chat.Completions.CompletionCreateParams) {
  if (groqClients.length === 0) {
    throw new Error('Groq API key missing')
  }
  const startIndex = groqIndex % groqClients.length
  groqIndex += 1
  const ordered = groqClients.length === 1
    ? groqClients
    : [groqClients[startIndex], ...groqClients.filter((_, idx) => idx !== startIndex)]

  let lastError: any
  for (const client of ordered) {
    try {
      return await client.chat.completions.create(params)
    } catch (error: any) {
      lastError = error
      const status = error?.status || error?.statusCode
      if (status === 429 || status >= 500) continue
    }
  }
  throw lastError || new Error('Groq completion failed')
}

const SYSTEM_PROMPT = `You are a financial analysis AI assistant. 
Your role is to provide concise, factual analysis about stock market data and trends.
IMPORTANT DISCLAIMERS:
- Never provide personalized financial advice
- Always state that past performance doesn't guarantee future results
- Keep responses under 200 words
- Focus on facts and data interpretation
- Never recommend buying or selling specific stocks`

export async function getStockInsight(symbol: string, data: any, prompt: string): Promise<string> {
  if (groqClients.length === 0) {
    return 'AI insights unavailable - API key not configured'
  }

  try {
    const context = JSON.stringify(data, null, 2)
    
    const response = await callGroqCompletion({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Based on this data for ${symbol}:\n${context}\n\nAnswer: ${prompt}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    })

    return response.choices[0]?.message?.content || 'Unable to generate insight'
  } catch (error) {
    console.error('AI request failed:', error)
    return 'AI insight generation failed. Please try again later.'
  }
}

export async function getWatchlistInsight(prompt: string, watchlistData: any[]): Promise<string> {
  if (groqClients.length === 0) {
    return 'AI insights unavailable - API key not configured'
  }

  try {
    const context = JSON.stringify(watchlistData, null, 2)
    
    const response = await callGroqCompletion({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Based on this watchlist data:\n${context}\n\nAnswer: ${prompt}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    })

    return response.choices[0]?.message?.content || 'Unable to generate insight'
  } catch (error) {
    console.error('AI request failed:', error)
    return 'AI insight generation failed. Please try again later.'
  }
}

export async function explainDaysMove(symbol: string, quote: any): Promise<string> {
  return getStockInsight(symbol, quote, 'Explain today\'s price movement in concise terms (<120 words)')
}

export async function summarizeWatchlist(watchlistData: any[]): Promise<string> {
  return getWatchlistInsight('Summarize the biggest movements in this watchlist today', watchlistData)
}

export async function getRiskCatalysts(symbol: string, quote: any): Promise<string> {
  return getStockInsight(symbol, quote, 'List 3 key risks and 3 potential catalysts for this quarter')
}
