// Comprehensive tool implementations for AI Market Analyst
import { getMultiSourceNews } from '@/lib/news-multi-source'
import { summarizeNews } from '@/lib/gemini'
import { resolveTicker } from '@/lib/ticker-mapper'
import { getQuoteWithFallback } from '@/lib/providers/market-data'

export interface ToolResult {
  data: any
  error?: string
  timestamp?: string
}

// Format timestamp to ET
function formatET(date: Date): string {
  return new Date(date.getTime()).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' ET'
}

// get_quote tool
export async function getQuote(symbol: string, fields?: string[]): Promise<ToolResult> {
  try {
    // Resolve ticker from symbol, handling company names
    const resolvedSymbol = resolveTicker(symbol)
    const quote = await getQuoteWithFallback(resolvedSymbol)
    return {
      data: {
        symbol: quote.symbol,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePct,
        volume: quote.volume,
        marketCap: quote.marketCap,
        currency: quote.currency || 'USD',
        open: quote.open,
        high: quote.high,
        low: quote.low,
        prevClose: quote.previousClose,
        fetchedAt: quote.fetchedAt,
        source: quote.source,
        stale: quote.stale || false,
      },
      timestamp: formatET(new Date()),
    }
  } catch (error: any) {
    return { data: null, error: error.message || 'quote_unavailable' }
  }
}

// get_news tool with Gemini summarization
export async function getNews(query?: string, symbols?: string[], from?: string, to?: string, limit = 10, languages = ['en']): Promise<ToolResult> {
  try {
    // Resolve ticker from query or symbols, handling company names like "Amazon" -> "AMZN"
    let symbol = symbols?.[0] || query || ''
    if (!symbol) return { data: { items: [], summaries: [] }, error: 'symbol_or_query_required' }
    
    // Convert company names to tickers
    symbol = resolveTicker(symbol)
    
    const items = await getMultiSourceNews(symbol)
    
    // Filter by date range if provided
    let filtered = items
    if (from) {
      const fromDate = new Date(from).getTime()
      filtered = filtered.filter(n => (n.datetime || 0) >= fromDate)
    }
    if (to) {
      const toDate = new Date(to).getTime()
      filtered = filtered.filter(n => (n.datetime || 0) <= toDate)
    }
    
    // Sort by datetime (newest first) and limit
    filtered = filtered
      .sort((a, b) => (b.datetime || 0) - (a.datetime || 0))
      .slice(0, limit)
    
    // Summarize top news using Gemini
    let summaries: string[] = []
    if (filtered.length > 0) {
      try {
        summaries = await summarizeNews(
          filtered.slice(0, 5).map(item => ({
            headline: item.headline,
            summary: item.summary,
            source: item.source,
            datetime: item.datetime,
          })),
          Math.min(5, filtered.length)
        )
      } catch (err) {
        console.error('News summarization failed:', err)
        summaries = filtered.slice(0, 3).map(n => `${n.headline} (${n.source})`)
      }
    }
    
    return {
      data: {
        items: filtered.map(item => ({
          headline: item.headline,
          summary: item.summary,
          source: item.source,
          url: item.url,
          datetime: item.datetime,
          formattedTime: item.datetime ? formatET(new Date(item.datetime)) : 'Unknown',
        })),
        summaries,
        count: filtered.length,
      },
      timestamp: formatET(new Date()),
    }
  } catch (error: any) {
    return { data: { items: [], summaries: [] }, error: error.message || 'news_unavailable' }
  }
}

// get_trending tool (placeholder - implement with market data)
export async function getTrending(market = 'US', limit = 20): Promise<ToolResult> {
  try {
    // Popular stocks - could be enhanced with actual trending data
    const popular = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX']
    const quotes = await Promise.allSettled(
      popular.slice(0, limit).map(sym => getQuote(sym))
    )
    
    const results = quotes
      .filter((r): r is PromiseFulfilledResult<ToolResult> => r.status === 'fulfilled')
      .map(r => r.value.data)
      .filter(d => d && d.price)
      .sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0))
    
    // Fetch news for top 5 gainers
    const topGainers = results
      .filter(d => (d.changePercent || 0) > 0)
      .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
      .slice(0, 5)
    
    const newsPromises = topGainers.map(async (stock) => {
      try {
        const newsResult = await getNews(stock.symbol, undefined, undefined, undefined, 3)
        return {
          symbol: stock.symbol,
          news: newsResult.data?.summaries || newsResult.data?.items?.slice(0, 3) || []
        }
      } catch {
        return { symbol: stock.symbol, news: [] }
      }
    })
    
    const newsResults = await Promise.allSettled(newsPromises)
    const newsMap: Record<string, any[]> = {}
    newsResults.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value.news.length > 0) {
        newsMap[r.value.symbol] = r.value.news
      }
    })
    
    return {
      data: {
        stocks: results,
        news: newsMap, // News for top gainers
        market,
        count: results.length,
      },
      timestamp: formatET(new Date()),
    }
  } catch (error: any) {
    return { data: { stocks: [], news: {} }, error: error.message || 'trending_unavailable' }
  }
}

// get_earnings tool (placeholder - implement with earnings data)
export async function getEarnings(symbol: string, range: 'last' | 'next' | 'calendar' = 'last'): Promise<ToolResult> {
  try {
    const s = resolveTicker(symbol)
    const FINNHUB = process.env.FINNHUB_KEY || process.env.NEXT_PUBLIC_FINNHUB_KEY
    const FMP = process.env.FMP_KEY || process.env.NEXT_PUBLIC_FMP_KEY

    // Helper to fetch with timeout
    const withTimeout = (p: Promise<Response>, ms = 6000) => {
      return Promise.race([
        p,
        new Promise<Response>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)) as any,
      ])
    }

    let items: any[] = []
    let source = ''

    // 1) Finnhub earnings calendar
    if (FINNHUB) {
      try {
        const now = new Date()
        const addDays = (d: number) => { const x = new Date(now); x.setDate(x.getDate()+d); return x.toISOString().slice(0,10) }
        const from = range === 'last' ? addDays(-120) : addDays(0)
        const to = range === 'last' ? addDays(0) : addDays(120)
        const url = `https://finnhub.io/api/v1/calendar/earnings?symbol=${encodeURIComponent(s)}&from=${from}&to=${to}&token=${FINNHUB}`
        const r = await withTimeout(fetch(url, { next: { revalidate: 60 }}))
        if (r.ok) {
          const j = await r.json()
          const arr = Array.isArray(j.earningsCalendar) ? j.earningsCalendar : []
          items = arr.map((e:any)=>({
            date: e.date,
            symbol: e.symbol || s,
            epsActual: e.epsActual ?? null,
            epsEstimate: e.epsEstimate ?? null,
            revenueActual: e.revenueActual ?? null,
            revenueEstimate: e.revenueEstimate ?? null,
            time: e.hour || e.quarter || null,
            source: 'Finnhub'
          }))
          source = 'Finnhub'
        }
      } catch {}
    }

    // 2) FMP fallback
    if (items.length === 0 && FMP) {
      try {
        const endpoint = range === 'last' ? 'historical/earning_calendar' : 'earning_calendar'
        const url = `https://financialmodelingprep.com/api/v3/${endpoint}/${encodeURIComponent(s)}?apikey=${FMP}`
        const r = await withTimeout(fetch(url, { next: { revalidate: 60 }}))
        if (r.ok) {
          const j = await r.json()
          const arr = Array.isArray(j) ? j : []
          items = arr.map((e:any)=>({
            date: e.date || e.epsActualDate || e.fiscalDateEnding,
            symbol: e.symbol || s,
            epsActual: e.epsActual ?? e.eps ?? null,
            epsEstimate: e.epsEstimated ?? e.epsEstimated ?? null,
            revenueActual: e.revenue ?? e.revenueActual ?? null,
            revenueEstimate: e.revenueEstimated ?? null,
            time: e.time || null,
            source: 'FMP'
          }))
          source = 'FMP'
        }
      } catch {}
    }

    return {
      data: { symbol: s, range, items, source },
      timestamp: formatET(new Date()),
    }
  } catch (error: any) {
    return { data: null, error: error.message || 'earnings_unavailable' }
  }
}

// web_search tool (placeholder - implement with SERP/crawler)
export async function webSearch(query: string, siteFilters?: string[], limit = 5): Promise<ToolResult> {
  try {
    // Placeholder - would integrate with SERP API or Playwright crawler
    return {
      data: {
        query,
        results: [],
        message: 'Web search integration pending',
      },
      timestamp: formatET(new Date()),
    }
  } catch (error: any) {
    return { data: { results: [] }, error: error.message || 'web_search_unavailable' }
  }
}

// kb_retrieve tool (placeholder - implement with RAG/Supabase)
export async function kbRetrieve(query: string, topK = 5): Promise<ToolResult> {
  try {
    // Placeholder - would integrate with Supabase pgvector RAG
    return {
      data: {
        query,
        documents: [],
        message: 'Knowledge Base RAG integration pending',
      },
      timestamp: formatET(new Date()),
    }
  } catch (error: any) {
    return { data: { documents: [] }, error: error.message || 'kb_unavailable' }
  }
}

