import axios from 'axios'

const FINNHUB_KEY = process.env.FINNHUB_API_KEY
const ALPHAVANTAGE_KEY = process.env.ALPHAVANTAGE_API_KEY

export interface NewsItem {
  id: string
  datetime: number
  headline: string
  source: string
  url: string
  image?: string
  summary?: string
}

// Fetch from Yahoo Finance (includes Canadian stocks)
async function fetchYahooNews(symbol: string): Promise<NewsItem[]> {
  try {
    // For Canadian stocks, try both TSX format and .TO format
    const searchSymbol = symbol.endsWith('.TO') ? symbol.replace('.TO', '') : symbol
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${searchSymbol}&quotesCount=1&newsCount=10`
    const response = await axios.get(url, { timeout: 3000 })
    
    if (response.data?.news) {
      return response.data.news.map((item: any, idx: number) => ({
        id: `yahoo-${item.uuid || idx}`,
        datetime: item.providerPublishTime || Date.now(),
        headline: item.title,
        source: 'Yahoo Finance',
        url: item.link,
        image: item.thumbnail?.resolutions?.[0]?.url,
        summary: item.summary,
      }))
    }
    return []
  } catch (error: any) {
    console.log('Yahoo news failed:', error.message)
    return []
  }
}

// Fetch from Yahoo Finance Canada
async function fetchYahooCanadaNews(symbol: string): Promise<NewsItem[]> {
  try {
    const searchSymbol = symbol.endsWith('.TO') ? symbol.replace('.TO', '') : symbol
    // Yahoo Finance Canada uses ca.finance.yahoo.com
    const url = `https://ca.finance.yahoo.com/v1/finance/search?q=${searchSymbol}&quotesCount=1&newsCount=10`
    const response = await axios.get(url, { timeout: 3000 })
    
    if (response.data?.news) {
      return response.data.news.map((item: any, idx: number) => ({
        id: `yahoo-ca-${item.uuid || idx}`,
        datetime: item.providerPublishTime || Date.now(),
        headline: item.title,
        source: 'Yahoo Finance Canada',
        url: item.link,
        image: item.thumbnail?.resolutions?.[0]?.url,
        summary: item.summary,
      }))
    }
    return []
  } catch (error: any) {
    console.log('Yahoo Canada news failed:', error.message)
    return []
  }
}

// Fetch from Financial Post (Canadian financial news)
async function fetchFinancialPostNews(symbol: string): Promise<NewsItem[]> {
  try {
    // Financial Post RSS feed search
    const searchSymbol = symbol.endsWith('.TO') ? symbol.replace('.TO', '') : symbol
    const url = `https://financialpost.com/search?q=${encodeURIComponent(searchSymbol)}`
    // Note: This is a placeholder - Financial Post may require different API
    // For now, return empty and let other sources handle it
    return []
  } catch (error: any) {
    console.log('Financial Post news failed:', error.message)
    return []
  }
}

// Fetch from Finnhub
async function fetchFinnhubNews(symbol: string): Promise<NewsItem[]> {
  if (!FINNHUB_KEY) return []
  
  try {
    const today = new Date()
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const from = sevenDaysAgo.toISOString().split('T')[0]
    const to = today.toISOString().split('T')[0]
    
    const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
    const response = await axios.get(url, { timeout: 3000 })
    
    if (response.data) {
      return response.data.slice(0, 10).map((item: any) => ({
        id: item.id?.toString() || `finnhub-${item.url}`,
        datetime: item.datetime,
        headline: item.headline,
        source: item.source,
        url: item.url,
        image: item.image,
        summary: item.summary,
      }))
    }
    return []
  } catch (error: any) {
    console.log('Finnhub news failed:', error.message)
    return []
  }
}

// Fetch from Alpha Vantage
async function fetchAlphaVantageNews(symbol: string): Promise<NewsItem[]> {
  if (!ALPHAVANTAGE_KEY) return []
  
  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${ALPHAVANTAGE_KEY}&limit=10`
    const response = await axios.get(url, { timeout: 3000 })
    
    if (response.data?.feed) {
      return response.data.feed.slice(0, 10).map((item: any, idx: number) => ({
        id: `av-${item.url || idx}`,
        datetime: item.time_published ? new Date(item.time_published).getTime() : Date.now(),
        headline: item.title,
        source: item.source || 'Alpha Vantage',
        url: item.url,
        summary: item.summary,
      }))
    }
    return []
  } catch (error: any) {
    console.log('Alpha Vantage news failed:', error.message)
    return []
  }
}

// Fetch general market news (fallback)
async function fetchGeneralNews(): Promise<NewsItem[]> {
  try {
    const url = 'https://query1.finance.yahoo.com/v1/finance/search?q=stock%20market&quotesCount=0&newsCount=10'
    const response = await axios.get(url, { timeout: 3000 })
    
    if (response.data?.news) {
      return response.data.news.map((item: any, idx: number) => ({
        id: `general-${item.uuid || idx}`,
        datetime: item.providerPublishTime || Date.now(),
        headline: item.title,
        source: item.provider?.displayName || 'Yahoo',
        url: item.link,
        image: item.thumbnail?.resolutions?.[0]?.url,
        summary: item.summary,
      }))
    }
    return []
  } catch (error: any) {
    console.log('General news failed:', error.message)
    return []
  }
}

// Main function with multi-source aggregation
export async function getMultiSourceNews(symbol: string): Promise<NewsItem[]> {
  const isCanadianStock = symbol.endsWith('.TO') || symbol.includes('.TO')
  
  const newsPromises = [
    fetchYahooNews(symbol),
    fetchFinnhubNews(symbol),
    fetchAlphaVantageNews(symbol),
  ]
  
  // Add Canadian-specific sources for Canadian stocks
  if (isCanadianStock) {
    newsPromises.push(
      fetchYahooCanadaNews(symbol),
      fetchFinancialPostNews(symbol)
    )
  }
  
  // Fetch all sources in parallel
  const results = await Promise.allSettled(newsPromises)
  
  // Combine all successful results
  const allNews: NewsItem[] = []
  const seenUrls = new Set<string>()
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const item of result.value) {
        // Deduplicate by URL
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url)
          allNews.push(item)
        }
      }
    }
  }
  
  // Sort by datetime (newest first)
  allNews.sort((a, b) => b.datetime - a.datetime)
  
  // If we have enough news, return it
  if (allNews.length >= 5) {
    return allNews.slice(0, 20)
  }
  
  // Otherwise, add general market news as fallback
  try {
    const generalNews = await fetchGeneralNews()
    for (const item of generalNews) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url)
        allNews.push(item)
      }
    }
  } catch (error) {
    console.log('General news fallback failed')
  }
  
  return allNews.slice(0, 20)
}

