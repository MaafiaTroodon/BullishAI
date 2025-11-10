/**
 * AI Knowledge Trainer
 * Uses stock_qa_100k.json to enhance AI responses with domain-specific knowledge
 */

import { QAData } from './chat-knowledge-base'

/**
 * Find best matching Q&A from knowledge base for a query
 */
export function findBestMatch(
  query: string,
  knowledgeBase: QAData[],
  limit: number = 3
): QAData[] {
  if (knowledgeBase.length === 0) return []

  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

  // Score each entry
  const scored = knowledgeBase.map(entry => {
    let score = 0

    // Exact question match (highest priority)
    if (entry.question.toLowerCase() === queryLower) {
      score += 100
    }

    // Question contains query or vice versa
    if (entry.question.toLowerCase().includes(queryLower)) {
      score += 20
    }
    if (queryLower.includes(entry.question.toLowerCase().substring(0, 20))) {
      score += 15
    }

    // Word matches in question
    queryWords.forEach(word => {
      const wordLower = word.toLowerCase()
      if (entry.question.toLowerCase().includes(wordLower)) {
        score += 5
      }
      if (entry.answer.toLowerCase().includes(wordLower)) {
        score += 3
      }
    })

    // Section match
    const sectionLower = entry.section.toLowerCase()
    queryWords.forEach(word => {
      if (sectionLower.includes(word.toLowerCase())) {
        score += 10
      }
    })

    // Tag matches
    entry.tags.forEach(tag => {
      if (queryLower.includes(tag.toLowerCase())) {
        score += 8
      }
    })

    // Ticker matches
    const queryUpper = query.toUpperCase()
    entry.tickers.forEach(ticker => {
      if (queryUpper.includes(ticker)) {
        score += 15
      }
    })

    return { entry, score }
  })

  // Sort by score and return top results
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.entry)
}

/**
 * Build enhanced prompt using knowledge base
 */
export function buildKnowledgePrompt(
  query: string,
  knowledgeBase: QAData[],
  relevantMatches: QAData[]
): string {
  // If we have a very good match (score > 50), use it more directly
  const bestMatch = relevantMatches[0]
  
  if (bestMatch && relevantMatches.length > 0) {
    // Use the knowledge base answer as a strong guide
    const examples = relevantMatches
      .slice(0, 3)
      .map(m => `Q: ${m.question}\nA: ${m.answer}`)
      .join('\n\n')

    return `You are BullishAI, a conversational market analyst. Use the following examples from our knowledge base to answer in a similar style:

${examples}

Now answer this question in the same conversational, concise style: ${query}

Guidelines:
- Match the tone and style of the examples above
- Keep it concise (1-3 sentences typically)
- Use natural language, not jargon
- Include specific tickers/numbers when available
- End with a friendly follow-up question
- Always include a brief risk note`
  }

  // Fallback to general prompt
  return `You are BullishAI, a conversational market analyst. Answer this question: ${query}

Keep it concise, friendly, and conversational. Use natural language.`
}

/**
 * Select best model based on query and knowledge base matches
 */
export function selectBestModel(
  query: string,
  matches: QAData[],
  hasRealTimeData: boolean
): 'groq-llama' | 'gemini' | 'local-pytorch' {
  const queryLower = query.toLowerCase()

  // Use local PyTorch if we have good knowledge base matches (domain-specific)
  if (matches.length > 0 && matches[0] && process.env.LOCAL_PYTORCH_ENABLED === 'true') {
    // Check if query matches domain-specific patterns
    if (queryLower.includes('screening') || 
        queryLower.includes('rationale') ||
        queryLower.includes('explain') ||
        matches[0].provider_hint === 'groq-llama') {
      return 'local-pytorch'
    }
  }

  // Use Gemini for complex analysis or document-based queries
  if (queryLower.includes('pdf') || 
      queryLower.includes('filing') || 
      queryLower.includes('financial statement') ||
      queryLower.includes('table') ||
      matches.some(m => m.provider_hint === 'gemini')) {
    return 'gemini'
  }

  // Default to Groq for quick insights and real-time queries
  return 'groq-llama'
}

