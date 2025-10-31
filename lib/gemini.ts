import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'gen-lang-client-0642332103'

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

export async function summarizeNews(newsItems: Array<{ headline: string; summary?: string; source: string; datetime?: number }>, maxItems = 3): Promise<string[]> {
  if (!newsItems || newsItems.length === 0) return []
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    
    // Take top 5 most recent news items
    const topNews = newsItems.slice(0, Math.min(5, newsItems.length))
    const newsText = topNews.map((n, idx) => 
      `${idx + 1}. ${n.headline}${n.summary ? ` - ${n.summary}` : ''} (${n.source})`
    ).join('\n')
    
    const prompt = `Summarize the following breaking news items about stocks. For each item, provide a 1-2 line summary focusing on the most relevant and breaking information. Format as a list of bullet points. Maximum ${maxItems} items:

${newsText}

Provide only the summaries, one per line, with a bullet point. Be concise and focus on what's most important.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Extract bullet points
    const lines = text.split('\n').filter(line => line.trim().length > 0 && (line.includes('•') || line.includes('-') || line.includes('*')))
    return lines.slice(0, maxItems).map(line => line.replace(/^[•\-\*]\s*/, '').trim())
  } catch (error: any) {
    console.error('Gemini summarization failed:', error.message)
    // Fallback: return first headlines as summaries
    return newsItems.slice(0, maxItems).map(n => `${n.headline} (${n.source})`)
  }
}

export async function generateBrandResponse(query: string, context?: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      systemInstruction: `You are a friendly, articulate, and professional AI Brand Assistant for BullishAI. You represent BullishAI on its website and engage directly with visitors—many of whom are new to the company, unfamiliar with its AI-powered stock dashboard, and interested in learning about investment technology solutions. Your role is to educate, assist, and guide visitors using only information retrieved from BullishAI's Knowledge Base (RAG). You must never supplement answers with your own general knowledge or assumptions.

Your behavior follows these precise rules:

1. Respond exclusively with retrieved Knowledge Base content
2. Address the full range of BullishAI-related questions, if knowledge exists
3. Format responses for clarity and engagement
4. Apply a helpful, respectful, and brand-aligned tone
5. Never escalate to humans or refer to live agents
6. Adapt to varying Knowledge Base coverage
7. Prioritize security and privacy

Always be helpful, clear, and professional. If you don't have specific information, say so clearly.`
    })
    
    const prompt = context 
      ? `${query}\n\nContext: ${context}`
      : query
    
    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error: any) {
    console.error('Gemini brand response failed:', error.message)
    return 'I apologize, but I encountered an error processing your request. Please try again or ask a different question.'
  }
}

