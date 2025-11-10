/**
 * Conversational Chat Presets - Natural questions users would ask
 */

export interface ChatPreset {
  id: string
  emoji: string
  title: string
  question: string
  description: string
  category: 'quick-insights' | 'recommended' | 'technical'
}

export const chatPresets: ChatPreset[] = [
  // Quick Insights
  {
    id: 'market-summary',
    emoji: '📰',
    title: "How's the market doing today?",
    question: 'Give me a short summary of how the stock market is performing right now.',
    description: 'Summarizes indexes, VIX, top sectors, and trending tickers.',
    category: 'quick-insights',
  },
  {
    id: 'top-movers',
    emoji: '🚀',
    title: 'What are the top moving stocks today?',
    question: 'Which stocks are rising or falling the most right now?',
    description: 'Fetches top gainers/losers with reasons (earnings, news).',
    category: 'quick-insights',
  },
  {
    id: 'sector-performance',
    emoji: '💡',
    title: 'Which sectors are strongest or weakest today?',
    question: 'Show me which sectors are leading or lagging in performance.',
    description: 'Displays a live sector heatmap.',
    category: 'quick-insights',
  },
  {
    id: 'breaking-news',
    emoji: '🔍',
    title: "What's the latest breaking market news?",
    question: 'Any major headlines moving the market right now?',
    description: 'Lists 5–10 live news-based movers with % change.',
    category: 'quick-insights',
  },
  {
    id: 'unusual-volume',
    emoji: '📈',
    title: 'Which stocks have unusual trading activity?',
    question: 'Show me companies trading way above normal volume today.',
    description: 'Fetches high relative-volume stocks.',
    category: 'quick-insights',
  },
  {
    id: 'earnings-today',
    emoji: '💰',
    title: "Who's reporting earnings today?",
    question: 'Which companies have earnings today and how are they doing?',
    description: 'Shows today\'s earnings with expected move.',
    category: 'quick-insights',
  },
  
  // Recommended Stocks
  {
    id: 'upgrades',
    emoji: '⭐',
    title: 'Which stocks got upgraded today?',
    question: 'Which companies did analysts upgrade to Buy or Strong Buy?',
    description: 'Lists upgrades + target price changes.',
    category: 'recommended',
  },
  {
    id: 'breakouts',
    emoji: '📊',
    title: 'Which stocks just broke out to new highs?',
    question: 'Which stocks are hitting fresh highs with strong trading volume?',
    description: 'Finds stocks at 52W highs with strong demand.',
    category: 'recommended',
  },
  {
    id: 'value-quality',
    emoji: '💎',
    title: 'Which stocks are high quality but still cheap?',
    question: 'Give me stocks that are profitable and undervalued right now.',
    description: 'Screens for low PE, high ROE, solid growth.',
    category: 'recommended',
  },
  {
    id: 'momentum',
    emoji: '⚡',
    title: 'Which stocks are gaining strong short-term momentum?',
    question: 'Show me stocks that have been climbing fast this week.',
    description: 'Lists top 5-day performers with liquidity filter.',
    category: 'recommended',
  },
  {
    id: 'rebound',
    emoji: '🔄',
    title: 'Which stocks are bouncing back after a drop?',
    question: 'Show me oversold stocks that are starting to recover.',
    description: 'Finds RSI <35 with positive reversal.',
    category: 'recommended',
  },
  {
    id: 'dividend-momentum',
    emoji: '🏦',
    title: 'Which dividend stocks are also gaining momentum?',
    question: 'Show me dividend-paying stocks that are trending upward.',
    description: 'Combines dividend yield + RS performance.',
    category: 'recommended',
  },
  
  // Technical Analysis
  {
    id: 'trend-levels',
    emoji: '📉',
    title: "What's the trend and key price levels for this stock?",
    question: 'Is AAPL in an uptrend or downtrend, and what are its support/resistance levels?',
    description: 'Uses SMAs + pivots.',
    category: 'technical',
  },
  {
    id: 'chart-patterns',
    emoji: '🔺',
    title: 'Do you see any chart patterns forming?',
    question: 'Do you see triangles, flags, or double bottoms on AAPL?',
    description: 'Detects classic patterns.',
    category: 'technical',
  },
  {
    id: 'technical-health',
    emoji: '⚙️',
    title: "How's the technical health of this stock?",
    question: "What's AAPL's RSI, MACD, and momentum like today?",
    description: 'Computes indicators.',
    category: 'technical',
  },
  {
    id: 'risk-reward',
    emoji: '🎯',
    title: "What's the risk and reward if I buy now?",
    question: 'Where should I set my target and stop loss if I buy AAPL?',
    description: 'Computes risk/reward ratio.',
    category: 'technical',
  },
  {
    id: 'multi-timeframe',
    emoji: '⏱️',
    title: 'How does this stock look across timeframes?',
    question: 'Is AAPL bullish on daily and weekly charts?',
    description: 'Multi-timeframe alignment check.',
    category: 'technical',
  },
  {
    id: 'risk-note',
    emoji: '⚠️',
    title: 'Any caution I should know?',
    question: "Give me one short risk note about AAPL's current setup.",
    description: 'Short volatility-based disclaimer.',
    category: 'technical',
  },
]

export function getPresetsByCategory(category: 'quick-insights' | 'recommended' | 'technical'): ChatPreset[] {
  return chatPresets.filter(p => p.category === category)
}

export function getPresetById(id: string): ChatPreset | undefined {
  return chatPresets.find(p => p.id === id)
}

