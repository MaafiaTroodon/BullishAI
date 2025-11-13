export type ChatDomain =
  | 'market_overview'
  | 'ticker_focus'
  | 'portfolio_wallet'
  | 'news_events'
  | 'education_finance'
  | 'coding_tech'
  | 'general_chat'

interface DomainDetectionResult {
  domain: ChatDomain
  isRecommendedPreset: boolean
}

const CODING_KEYWORDS = [
  'error',
  'exception',
  'stack trace',
  'typescript',
  'javascript',
  'python',
  'bug',
  'next.js',
  'react',
  'code',
  'function',
  'component',
]

const PORTFOLIO_KEYWORDS = [
  'portfolio',
  'holdings',
  'positions',
  'p/l',
  'profit',
  'loss',
  'wallet',
  'deposits',
  'withdrawals',
  'transactions',
]

const NEWS_KEYWORDS = [
  'news',
  'headline',
  'breaking',
  'earnings',
  'dividend',
  'calendar',
  'events',
  'catalyst',
]

/**
 * Classify the incoming chat message into a domain
 */
export function classifyChatDomain(query: string, symbol?: string | null, isRecommended: boolean = false): DomainDetectionResult {
  const lower = query.toLowerCase()

  // Coding / technical questions
  if (CODING_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return { domain: 'coding_tech', isRecommendedPreset: isRecommended }
  }

  // Portfolio or wallet questions
  if (PORTFOLIO_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return { domain: 'portfolio_wallet', isRecommendedPreset: isRecommended }
  }

  // News or events
  if (NEWS_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return { domain: 'news_events', isRecommendedPreset: isRecommended }
  }

  // Market overview keywords
  if (
    lower.includes('market') ||
    lower.includes('sector') ||
    lower.includes('index') ||
    lower.includes('mover') ||
    lower.includes('volume') ||
    lower.includes('heatmap')
  ) {
    return { domain: 'market_overview', isRecommendedPreset: isRecommended }
  }

  // Ticker focus if there is a ticker or symbol reference
  if (symbol || /[A-Z]{1,5}(?:\.[A-Z]{1,3})?/.test(query)) {
    return { domain: 'ticker_focus', isRecommendedPreset: isRecommended }
  }

  // Finance education questions (what is, explain)
  if (
    lower.includes('what is') ||
    lower.includes('explain') ||
    lower.includes('difference') ||
    lower.includes('definition') ||
    lower.includes('how does') ||
    lower.includes('meaning')
  ) {
    return { domain: 'education_finance', isRecommendedPreset: isRecommended }
  }

  // Default to general chat
  return { domain: 'general_chat', isRecommendedPreset: isRecommended }
}


