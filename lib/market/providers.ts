import axios from 'axios'

const FINNHUB_KEY = process.env.FINNHUB_API_KEY
const TWELVEDATA_KEY = process.env.TWELVEDATA_API_KEY

export type Quote = {
  symbol: string
  price: number
  changePct: number | null
  open: number | null
  high: number | null
  low: number | null
  prevClose: number | null
  volume: number | null
  fiftyTwoWkHigh: number | null
  fiftyTwoWkLow: number | null
  asOf: string
  source: 'finnhub' | 'twelvedata' | 'yahoo'
}

export type NewsItem = {
  symbol: string
  headline: string
  source: string
  url: string
  publishedAt: string
  sentiment: 'positive' | 'negative' | 'neutral' | null
}

export type Fundamentals = {
  symbol: string
  pe: number | null
  eps: number | null
  marketCap: number | null
  revenueTTM: number | null
  profitMargin: number | null
  sector: string | null
  industry: string | null
  asOf: string
  source: 'finnhub' | 'twelvedata' | 'yahoo'
}

// ===== FINNHUB PROVIDER =====

async function getQuote_finnhub(symbol: string): Promise<Quote | null> {
  if (!FINNHUB_KEY) return null

  try {
    const response = await axios.get('https://finnhub.io/api/v1/quote', {
      params: { symbol, token: FINNHUB_KEY },
      timeout: 5000,
    })

    if (!response.data || response.data.c === null) return null

    return {
      symbol,
      price: response.data.c,
      changePct: ((response.data.c - response.data.pc) / response.data.pc) * 100,
      open: response.data.o,
      high: response.data.h,
      low: response.data.l,
      prevClose: response.data.pc,
      volume: response.data.v,
      fiftyTwoWkHigh: response.data.h,
      fiftyTwoWkLow: response.data.l,
      asOf: new Date().toISOString(),
      source: 'finnhub',
    }
  } catch (error) {
    console.error(`Finnhub quote error for ${symbol}:`, error)
    return null
  }
}

async function getNews_finnhub(symbol: string, limit: number): Promise<NewsItem[]> {
  if (!FINNHUB_KEY) return []

  try {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 2)

    const from = yesterday.toISOString().split('T')[0]
    const to = today.toISOString().split('T')[0]

    const response = await axios.get('https://finnhub.io/api/v1/company-news', {
      params: { symbol, from, to, token: FINNHUB_KEY },
      timeout: 5000,
    })

    if (!Array.isArray(response.data)) return []

    return response.data.slice(0, limit).map((item: any) => ({
      symbol,
      headline: item.headline || 'No headline',
      source: item.source || 'Unknown',
      url: item.url || '#',
      publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
      sentiment: item.sentiment || null,
    }))
  } catch (error) {
    console.error(`Finnhub news error for ${symbol}:`, error)
    return []
  }
}

async function getFundamentals_finnhub(symbol: string): Promise<Fundamentals | null> {
  if (!FINNHUB_KEY) return null

  try {
    const [profileRes, quoteRes] = await Promise.all([
      axios.get('https://finnhub.io/api/v1/stock/profile2', {
        params: { symbol, token: FINNHUB_KEY },
        timeout: 5000,
      }),
      axios.get('https://finnhub.io/api/v1/quote', {
        params: { symbol, token: FINNHUB_KEY },
        timeout: 5000,
      }),
    ])

    const profile = profileRes.data
    const quote = quoteRes.data

    return {
      symbol,
      pe: profile.finnhubIndustry ? profile.finnhubIndustry : null,
      eps: null, // Not available from profile2
      marketCap: profile.marketCapitalization || null,
      revenueTTM: null,
      profitMargin: null,
      sector: profile.finnhubIndustry || null,
      industry: profile.finnhubIndustry || null,
      asOf: new Date().toISOString(),
      source: 'finnhub',
    }
  } catch (error) {
    console.error(`Finnhub fundamentals error for ${symbol}:`, error)
    return null
  }
}

// ===== TWELVEDATA PROVIDER =====

async function getQuote_twelvedata(symbol: string): Promise<Quote | null> {
  if (!TWELVEDATA_KEY) return null

  try {
    const response = await axios.get('https://api.twelvedata.com/quote', {
      params: { symbol, apikey: TWELVEDATA_KEY },
      timeout: 5000,
    })

    if (!response.data || response.data.status === 'error') return null

    const data = response.data
    const price = parseFloat(data.close)
    const previousClose = parseFloat(data.previous_close)

    return {
      symbol,
      price,
      changePct: ((price - previousClose) / previousClose) * 100,
      open: parseFloat(data.open),
      high: parseFloat(data.high),
      low: parseFloat(data.low),
      prevClose: previousClose,
      volume: parseFloat(data.volume) || null,
      fiftyTwoWkHigh: parseFloat(data['52_week_high']),
      fiftyTwoWkLow: parseFloat(data['52_week_low']),
      asOf: new Date().toISOString(),
      source: 'twelvedata',
    }
  } catch (error) {
    console.error(`TwelveData quote error for ${symbol}:`, error)
    return null
  }
}

async function getNews_twelvedata(symbol: string, limit: number): Promise<NewsItem[]> {
  if (!TWELVEDATA_KEY) return []

  try {
    const response = await axios.get('https://api.twelvedata.com/news', {
      params: { symbol, apikey: TWELVEDATA_KEY, limit },
      timeout: 5000,
    })

    if (!Array.isArray(response.data)) return []

    return response.data.slice(0, limit).map((item: any) => ({
      symbol,
      headline: item.title || 'No headline',
      source: item.source || 'Unknown',
      url: item.url || '#',
      publishedAt: item.date || new Date().toISOString(),
      sentiment: null, // TwelveData doesn't provide sentiment
    }))
  } catch (error) {
    console.error(`TwelveData news error for ${symbol}:`, error)
    return []
  }
}

async function getFundamentals_twelvedata(symbol: string): Promise<Fundamentals | null> {
  if (!TWELVEDATA_KEY) return null

  try {
    const response = await axios.get('https://api.twelvedata.com/statistics', {
      params: { symbol, apikey: TWELVEDATA_KEY },
      timeout: 5000,
    })

    if (response.data.status === 'error') return null

    const data = response.data.meta
    if (!data) return null

    return {
      symbol,
      pe: data.price_to_earnings_ratio || null,
      eps: data.earnings_per_share || null,
      marketCap: data.market_capitalization || null,
      revenueTTM: data.ttm_revenue || null,
      profitMargin: data.profit_margin || null,
      sector: data.sector || null,
      industry: data.industry || null,
      asOf: new Date().toISOString(),
      source: 'twelvedata',
    }
  } catch (error) {
    console.error(`TwelveData fundamentals error for ${symbol}:`, error)
    return null
  }
}

// ===== YAHOO PROVIDER (FALLBACK) =====

async function getQuote_yahoo(symbol: string): Promise<Quote | null> {
  try {
    const response = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', {
      params: { symbols: symbol },
      timeout: 5000,
    })

    const quote = response.data?.quoteResponse?.result?.[0]
    if (!quote) return null

    return {
      symbol,
      price: quote.regularMarketPrice,
      changePct: quote.regularMarketChangePercent,
      open: quote.regularMarketOpen,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      prevClose: quote.regularMarketPreviousClose,
      volume: quote.regularMarketVolume,
      fiftyTwoWkHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWkLow: quote.fiftyTwoWeekLow,
      asOf: new Date().toISOString(),
      source: 'yahoo',
    }
  } catch (error) {
    console.error(`Yahoo quote error for ${symbol}:`, error)
    return null
  }
}

async function getNews_yahoo(symbol: string, limit: number): Promise<NewsItem[]> {
  try {
    const response = await axios.get(`https://query2.finance.yahoo.com/v1/finance/search`, {
      params: { q: symbol, newsCount: limit },
      timeout: 5000,
    })

    const news = response.data?.news || []
    if (!Array.isArray(news)) return []

    return news.slice(0, limit).map((item: any) => ({
      symbol,
      headline: item.title || 'No headline',
      source: item.publisher || 'Yahoo Finance',
      url: item.link || '#',
      publishedAt: item.providerPublishTime
        ? new Date(item.providerPublishTime * 1000).toISOString()
        : new Date().toISOString(),
      sentiment: null,
    }))
  } catch (error) {
    console.error(`Yahoo news error for ${symbol}:`, error)
    return []
  }
}

async function getFundamentals_yahoo(symbol: string): Promise<Fundamentals | null> {
  try {
    const response = await axios.get('https://query1.finance.yahoo.com/v10/finance/quoteSummary/' + symbol, {
      params: {
        modules: 'summaryProfile,defaultKeyStatistics',
      },
      timeout: 5000,
    })

    const profile = response.data?.quoteSummary?.result?.[0]?.summaryProfile
    const stats = response.data?.quoteSummary?.result?.[0]?.defaultKeyStatistics

    if (!profile) return null

    return {
      symbol,
      pe: stats?.trailingPE || null,
      eps: stats?.trailingEps || null,
      marketCap: stats?.marketCap?.raw || profile.marketCap?.raw || null,
      revenueTTM: null,
      profitMargin: null,
      sector: profile.sector || null,
      industry: profile.industry || null,
      asOf: new Date().toISOString(),
      source: 'yahoo',
    }
  } catch (error) {
    console.error(`Yahoo fundamentals error for ${symbol}:`, error)
    return null
  }
}

// ===== FALLBACK ORCHESTRATORS =====

export async function fetchQuote(symbol: string): Promise<Quote> {
  const providers = [getQuote_finnhub, getQuote_twelvedata, getQuote_yahoo]

  for (const provider of providers) {
    const result = await provider(symbol)
    if (result) {
      console.log(`Quote for ${symbol} from ${result.source}`)
      return result
    }
  }

  throw new Error(`Could not fetch quote for ${symbol} from any provider`)
}

export async function fetchNews(symbol: string, limit: number): Promise<NewsItem[]> {
  const providers = [getNews_finnhub, getNews_twelvedata, getNews_yahoo]

  for (const provider of providers) {
    const result = await provider(symbol, limit)
    if (result && result.length > 0) {
      console.log(`News for ${symbol} from ${result[0]?.source || 'unknown'}`)
      return result
    }
  }

  return []
}

export async function fetchFundamentals(symbol: string): Promise<Fundamentals> {
  const providers = [getFundamentals_finnhub, getFundamentals_twelvedata, getFundamentals_yahoo]

  for (const provider of providers) {
    const result = await provider(symbol)
    if (result) {
      console.log(`Fundamentals for ${symbol} from ${result.source}`)
      return result
    }
  }

  throw new Error(`Could not fetch fundamentals for ${symbol} from any provider`)
}

