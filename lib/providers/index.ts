import { getQuoteWithFallback } from '@/lib/providers/market-data'
import { getMultiSourceNews } from '@/lib/news-multi-source'
import { summarizeNews } from '@/lib/gemini'

export async function getQuote(symbol: string) {
  try {
    const res = await getQuoteWithFallback(symbol.toUpperCase())
    return {
      symbol: res?.symbol || symbol.toUpperCase(),
      price: res?.price ?? null,
      change: res?.change ?? null,
      changePct: res?.changePct ?? null,
      open: res?.open ?? null,
      high: res?.high ?? null,
      low: res?.low ?? null,
      prevClose: res?.previousClose ?? null,
      volume: res?.volume ?? null,
      marketCap: res?.marketCap ?? null,
      currency: res?.currency ?? 'USD',
      fetchedAt: res?.fetchedAt ?? Date.now(),
      stale: !!res?.stale,
      source: res?.source,
    }
  } catch {
    return { error: 'quote_unavailable', symbol: symbol.toUpperCase() }
  }
}

export async function getNews(symbol: string, lookbackHours = 48) {
  try {
    const items = await getMultiSourceNews(symbol)
    const cutoff = Date.now() - lookbackHours * 60 * 60 * 1000
    const filtered = items.filter(n => (n.datetime || 0) >= cutoff)
    
    // Summarize top news using Gemini for 1-2 line summaries
    let summaries: string[] = []
    if (filtered.length > 0) {
      try {
        summaries = await summarizeNews(
          filtered.slice(0, 5).map(item => ({
            headline: item.headline,
            summary: item.summary,
            source: item.source,
            datetime: item.datetime
          })),
          3 // Top 3 most breaking/relevant
        )
      } catch (err) {
        console.error('News summarization failed:', err)
        // Fallback to headlines
        summaries = filtered.slice(0, 3).map(n => `${n.headline} (${n.source})`)
      }
    }
    
    return { 
      items: filtered,
      summaries: summaries.length > 0 ? summaries : (filtered.slice(0, 3).map(n => `${n.headline} (${n.source})`))
    }
  } catch {
    return { items: [], summaries: [] }
  }
}

export async function getProfile(symbol: string) {
  // Minimal placeholder; pull richer profile later
  return { symbol }
}

export async function getFinancials(symbol: string, period: 'annual' | 'quarter') {
  // Placeholder; wire to FMP/Alpha later
  return { symbol, period, items: [] }
}

export async function getSentiment(symbol: string, lookbackHours = 48) {
  const news = await getNews(symbol, lookbackHours)
  // Simple neutral score placeholder
  return { score: 0, n: news.items.length, examples: news.items.slice(0, 5) }
}


