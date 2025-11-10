/**
 * Chat Knowledge Base - Uses stock_qa_100k.json for contextual Q&A
 */

interface QAData {
  id: number
  section: string
  question: string
  answer: string
  tickers: string[]
  tags: string[]
  provider_hint: string
  source: string
  created_at: string
}

let knowledgeBase: QAData[] | null = null

/**
 * Load knowledge base from JSON file
 */
async function loadKnowledgeBase(): Promise<QAData[]> {
  if (knowledgeBase) return knowledgeBase

  try {
    // In Next.js, we need to fetch from public or use a server-side approach
    // For now, we'll load it server-side via API
    const response = await fetch('/api/chat/knowledge-base')
    if (response.ok) {
      knowledgeBase = await response.json()
      return knowledgeBase || []
    }
  } catch (error) {
    console.error('Failed to load knowledge base:', error)
  }

  return []
}

/**
 * Search knowledge base for relevant context
 */
export async function searchKnowledgeBase(
  query: string,
  limit: number = 5
): Promise<QAData[]> {
  const kb = await loadKnowledgeBase()
  if (kb.length === 0) return []

  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

  // Score each entry
  const scored = kb.map(entry => {
    let score = 0

    // Exact question match
    if (entry.question.toLowerCase().includes(queryLower)) {
      score += 10
    }

    // Word matches in question
    queryWords.forEach(word => {
      if (entry.question.toLowerCase().includes(word)) {
        score += 3
      }
      if (entry.answer.toLowerCase().includes(word)) {
        score += 2
      }
    })

    // Section match (e.g., "momentum" → "Strongest Momentum")
    queryWords.forEach(word => {
      if (entry.section.toLowerCase().includes(word)) {
        score += 5
      }
    })

    // Tag matches
    entry.tags.forEach(tag => {
      if (queryLower.includes(tag.toLowerCase())) {
        score += 4
      }
    })

    // Ticker matches
    const queryUpper = query.toUpperCase()
    entry.tickers.forEach(ticker => {
      if (queryUpper.includes(ticker.toUpperCase())) {
        score += 6
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
 * Get section context based on query intent
 */
export function detectSection(query: string): string | null {
  const queryLower = query.toLowerCase()

  const sectionMap: Record<string, string> = {
    'momentum': 'Strongest Momentum',
    'quick insights': 'Quick Insights',
    'technical': 'Technical Analysis',
    'technical analysis': 'Technical Analysis',
    'should i buy': 'Should I Buy?',
    'recommended': "Today's Recommended Stocks",
    'value': 'Best Value Stocks',
    'undervalued': 'Undervalued Rebound',
    'rebound': 'Undervalued Rebound',
    'strongest today': 'Strongest Today',
    'stable growth': 'Stable Growth Picks',
    'top picks': 'Top Stock Picks',
  }

  for (const [key, section] of Object.entries(sectionMap)) {
    if (queryLower.includes(key)) {
      return section
    }
  }

  return null
}

/**
 * Extract tickers from query
 */
export function extractTickers(query: string): string[] {
  const tickerPattern = /\b[A-Z]{1,5}\b/g
  const matches = query.match(tickerPattern) || []
  // Filter out common words that might match
  const commonWords = ['AI', 'IT', 'IS', 'AM', 'AN', 'AS', 'AT', 'BE', 'DO', 'GO', 'IF', 'IN', 'ME', 'MY', 'NO', 'OF', 'ON', 'OR', 'SO', 'TO', 'UP', 'US', 'WE']
  return matches.filter(t => !commonWords.includes(t) && t.length >= 2)
}

