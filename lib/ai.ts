import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const SYSTEM_PROMPT = `You are a financial analysis AI assistant. 
Your role is to provide concise, factual analysis about stock market data and trends.
IMPORTANT DISCLAIMERS:
- Never provide personalized financial advice
- Always state that past performance doesn't guarantee future results
- Keep responses under 200 words
- Focus on facts and data interpretation
- Never recommend buying or selling specific stocks`

export async function getStockInsight(symbol: string, data: any, prompt: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    return 'AI insights unavailable - API key not configured'
  }

  try {
    const context = JSON.stringify(data, null, 2)
    
    const response = await groq.chat.completions.create({
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
  if (!process.env.GROQ_API_KEY) {
    return 'AI insights unavailable - API key not configured'
  }

  try {
    const context = JSON.stringify(watchlistData, null, 2)
    
    const response = await groq.chat.completions.create({
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

