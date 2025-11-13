/**
 * Helper functions to fetch live BullishAI data for recommended questions
 * These replace generic knowledge base responses with real-time data
 */

export interface MarketSummaryData {
  indices: Array<{ symbol: string; price: number; change: number; changePercent: number }>
  timestamp: string
  source: string
}

export interface TopMoversData {
  gainers: Array<{ symbol: string; name?: string; price: number; changePercent: number; volume?: number }>
  losers: Array<{ symbol: string; name?: string; price: number; changePercent: number; volume?: number }>
  timestamp: string
  source: string
}

export interface EarningsData {
  today: Array<{ symbol: string; name?: string; time?: string; estimate?: number }>
  timestamp: string
  source: string
}

export interface NewsData {
  items: Array<{ headline: string; summary?: string; source: string; datetime: number }>
  timestamp: string
  source: string
}

/**
 * Detect if query is a recommended question that needs live data
 */
export function isRecommendedQuestion(query: string): {
  type: 'market-summary' | 'top-movers' | 'sectors' | 'news' | 'earnings' | 'unusual-volume' | 
        'upgrades' | 'breakouts' | 'value-quality' | 'momentum' | 'rebound' | 'dividend-momentum' |
        'technical' | null
  needsLiveData: boolean
} {
  const lower = query.toLowerCase()
  
  // Market summary
  if (lower.includes('market') && (lower.includes('doing') || lower.includes('performing') || lower.includes('summary'))) {
    return { type: 'market-summary', needsLiveData: true }
  }
  
  // Top movers
  if (lower.includes('top') && (lower.includes('moving') || lower.includes('gainer') || lower.includes('loser') || lower.includes('rising') || lower.includes('falling'))) {
    return { type: 'top-movers', needsLiveData: true }
  }
  
  // Sectors
  if (lower.includes('sector') && (lower.includes('strongest') || lower.includes('weakest') || lower.includes('leading') || lower.includes('lagging'))) {
    return { type: 'sectors', needsLiveData: true }
  }
  
  // News
  if (lower.includes('news') || lower.includes('headline') || lower.includes('breaking')) {
    return { type: 'news', needsLiveData: true }
  }
  
  // Earnings
  if (lower.includes('earnings') || lower.includes('reporting') || lower.includes('eps')) {
    return { type: 'earnings', needsLiveData: true }
  }
  
  // Unusual volume
  if (lower.includes('unusual') && lower.includes('volume')) {
    return { type: 'unusual-volume', needsLiveData: true }
  }
  
  // Upgrades
  if (lower.includes('upgrade')) {
    return { type: 'upgrades', needsLiveData: true }
  }
  
  // Breakouts
  if (lower.includes('breakout') || lower.includes('new high')) {
    return { type: 'breakouts', needsLiveData: true }
  }
  
  // Value/Quality
  if (lower.includes('value') || (lower.includes('cheap') && lower.includes('quality'))) {
    return { type: 'value-quality', needsLiveData: true }
  }
  
  // Momentum
  if (lower.includes('momentum') || (lower.includes('climbing') && lower.includes('week'))) {
    return { type: 'momentum', needsLiveData: true }
  }
  
  // Rebound
  if (lower.includes('rebound') || (lower.includes('bouncing') && lower.includes('drop'))) {
    return { type: 'rebound', needsLiveData: true }
  }
  
  // Dividend momentum
  if (lower.includes('dividend') && lower.includes('momentum')) {
    return { type: 'dividend-momentum', needsLiveData: true }
  }
  
  // Technical (symbol-specific)
  if (lower.includes('trend') || lower.includes('rsi') || lower.includes('macd') || lower.includes('support') || lower.includes('resistance') || lower.includes('pattern')) {
    return { type: 'technical', needsLiveData: true }
  }
  
  return { type: null, needsLiveData: false }
}

/**
 * Fetch market summary (indices)
 */
export async function fetchMarketSummary(origin: string): Promise<MarketSummaryData | null> {
  try {
    const res = await fetch(`${origin}/api/quotes?symbols=SPY,QQQ,DIA,IWM,VIX`)
    const data = await res.json().catch(() => ({ quotes: [] }))
    
    const indices = (data.quotes || []).map((q: any) => {
      const price = q.data ? parseFloat(q.data.price || 0) : parseFloat(q.price || 0)
      const change = q.data ? parseFloat(q.data.change || 0) : parseFloat(q.change || 0)
      const changePercent = q.data ? parseFloat(q.data.dp || q.data.changePercent || 0) : parseFloat(q.changePercent || 0)
      
      return {
        symbol: q.symbol,
        price,
        change,
        changePercent,
      }
    }).filter((idx: any) => idx.price > 0)
    
    return {
      indices,
      timestamp: new Date().toISOString(),
      source: 'BullishAI Live Market Feed'
    }
  } catch (error) {
    console.error('Failed to fetch market summary:', error)
    return null
  }
}

/**
 * Fetch top movers
 */
export async function fetchTopMovers(origin: string): Promise<TopMoversData | null> {
  try {
    const res = await fetch(`${origin}/api/market/top-movers?limit=10`)
    const data = await res.json().catch(() => ({ gainers: [], losers: [] }))
    
    const gainers = (data.gainers || data.data?.gainers || []).slice(0, 5).map((m: any) => ({
      symbol: m.symbol,
      name: m.name,
      price: parseFloat(m.price || m.currentPrice || 0),
      changePercent: parseFloat(m.changePercent || m.changePct || 0),
      volume: m.volume,
    }))
    
    const losers = (data.losers || data.data?.losers || []).slice(0, 5).map((m: any) => ({
      symbol: m.symbol,
      name: m.name,
      price: parseFloat(m.price || m.currentPrice || 0),
      changePercent: parseFloat(m.changePercent || m.changePct || 0),
      volume: m.volume,
    }))
    
    return {
      gainers,
      losers,
      timestamp: new Date().toISOString(),
      source: 'BullishAI Top Movers'
    }
  } catch (error) {
    console.error('Failed to fetch top movers:', error)
    return null
  }
}

/**
 * Fetch earnings calendar
 */
export async function fetchEarnings(origin: string, range: 'today' | 'week' = 'today'): Promise<EarningsData | null> {
  try {
    const res = await fetch(`${origin}/api/calendar/earnings?range=${range}`)
    const data = await res.json().catch(() => ({ items: [] }))
    
    const today = (data.items || data.data || []).slice(0, 10).map((e: any) => ({
      symbol: e.symbol,
      name: e.name || e.companyName,
      time: e.time || e.timeET,
      estimate: e.epsEstimate || e.estimate,
    }))
    
    return {
      today,
      timestamp: new Date().toISOString(),
      source: 'BullishAI Earnings Calendar'
    }
  } catch (error) {
    console.error('Failed to fetch earnings:', error)
    return null
  }
}

/**
 * Fetch market news
 */
export async function fetchMarketNews(origin: string, limit: number = 10): Promise<NewsData | null> {
  try {
    const res = await fetch(`${origin}/api/news/movers?limit=${limit}`)
    const data = await res.json().catch(() => ({ items: [] }))
    
    const items = (data.items || []).slice(0, limit).map((n: any) => ({
      headline: n.headline || n.title,
      summary: n.summary,
      source: n.source || 'Market News',
      datetime: n.datetime || n.timestamp || Date.now(),
    }))
    
    return {
      items,
      timestamp: new Date().toISOString(),
      source: 'BullishAI News Feed'
    }
  } catch (error) {
    console.error('Failed to fetch news:', error)
    return null
  }
}

/**
 * Fetch recommended stocks (value, momentum, etc.)
 */
export async function fetchRecommendedStocks(origin: string, type: 'value' | 'momentum' | 'breakout' | 'rebound' | 'dividend'): Promise<any> {
  try {
    // Use the AI recommended endpoint or screener
    const endpoint = type === 'dividend' 
      ? `${origin}/api/screeners/dividend-momentum`
      : `${origin}/api/ai/recommended?theme=${type}`
    
    const res = await fetch(endpoint)
    const data = await res.json().catch(() => ({ data: [], stocks: [] }))
    
    const stocks = (data.data || data.stocks || []).slice(0, 10)
    
    return {
      stocks,
      timestamp: new Date().toISOString(),
      source: `BullishAI ${type.charAt(0).toUpperCase() + type.slice(1)} Screener`
    }
  } catch (error) {
    console.error(`Failed to fetch ${type} stocks:`, error)
    return null
  }
}

/**
 * Format timestamp to ET
 */
export function formatET(timestamp?: string | number): string {
  const date = timestamp ? new Date(timestamp) : new Date()
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' ET'
}

