import axios from 'axios'

const FINNHUB_KEY = process.env.FINNHUB_API_KEY
const TWELVEDATA_KEY = process.env.TWELVEDATA_API_KEY
const ALPHAVANTAGE_KEY = process.env.ALPHAVANTAGE_API_KEY

interface QuoteResult {
  price: number
  change: number
  changePct: number
  high?: number
  low?: number
  open?: number
  previousClose?: number
  volume?: number
  marketCap?: number
  peRatio?: number
  week52High?: number
  week52Low?: number
}


interface NewsItem {
  id: string
  datetime: number
  headline: string
  source: string
  url: string
  image?: string
  summary?: string
}

async function fetchJSON(url: string, timeoutMs = 2000): Promise<any> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function getQuote(symbol: string): Promise<QuoteResult> {
  // Try Finnhub first
  if (FINNHUB_KEY) {
    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
      const data = await fetchJSON(url, 2000)
      if (data && data.c) {
        return {
          price: data.c,
          change: data.d,
          changePct: data.dp,
          high: data.h,
          low: data.l,
          open: data.o,
          previousClose: data.pc,
        }
      }
    } catch (error) {
      console.log('Finnhub quote failed')
    }
  }

  // Fallback to Twelve Data
  if (TWELVEDATA_KEY) {
    try {
      const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVEDATA_KEY}`
      const data = await fetchJSON(url, 2000)
      if (data && data.close) {
        return {
          price: parseFloat(data.close),
          change: parseFloat(data.change),
          changePct: parseFloat(data.percent_change || '0'),
          high: parseFloat(data.high),
          low: parseFloat(data.low),
          open: parseFloat(data.open),
          previousClose: parseFloat(data.previous_close),
        }
      }
    } catch (error) {
      console.log('Twelve Data quote failed')
    }
  }

  // Final fallback to Alpha Vantage
  if (ALPHAVANTAGE_KEY) {
    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHAVANTAGE_KEY}`
      const data = await fetchJSON(url, 2000)
      const quote = data['Global Quote']
      if (quote && quote['05. price']) {
        return {
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePct: parseFloat(quote['10. change percent']?.replace('%', '') || '0'),
          high: parseFloat(quote['03. high']),
          low: parseFloat(quote['04. low']),
          open: parseFloat(quote['02. open']),
          previousClose: parseFloat(quote['08. previous close']),
        }
      }
    } catch (error) {
      console.log('Alpha Vantage quote failed')
    }
  }

  throw new Error('All quote providers failed')
}

export async function getCandles(symbol: string, range: string): Promise<{ data: CandleData[] }> {
  // Determine parameters based on range
  let interval = '1day'
  let days = 30
  if (range === '1d') { interval = '1min'; days = 1 }
  else if (range === '5d') { interval = '5min'; days = 5 }
  else if (range === '1m') { interval = '1day'; days = 30 }
  else if (range === '6m') { interval = '1day'; days = 180 }
  else if (range === '1y') { interval = '1day'; days = 365 }
  else if (range === '5y') { interval = '1week'; days = 365 * 5 }
  else if (range === 'max') { interval = '1day'; days = 365 * 5 }

  // Try Twelve Data first (most reliable free tier)
  if (TWELVEDATA_KEY) {
    try {
      const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=200&apikey=${TWELVEDATA_KEY}`
      const data = await fetchJSON(url, 2000)
      if (data && data.values && Array.isArray(data.values)) {
          const chartData = data.values
          .map((item: any) => ({
            timestamp: new Date(item.datetime).getTime(),
            close: parseFloat(item.close),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            open: parseFloat(item.open),
          }))
          .filter((item: any) => item.close > 0)
          .sort((a: any, b: any) => a.timestamp - b.timestamp) // Ensure chronological order
        if (chartData.length > 0) return { data: chartData }
      }
    } catch (error) {
      console.log('Twelve Data candles failed')
    }
  }

  // Fallback to Alpha Vantage
  if (ALPHAVANTAGE_KEY) {
    try {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=compact&apikey=${ALPHAVANTAGE_KEY}`
      const data = await fetchJSON(url, 2000)
      const timeSeries = data['Time Series (Daily)']
      if (timeSeries) {
        const chartData = Object.entries(timeSeries)
          .map(([date, values]: [string, any]) => ({
            timestamp: new Date(date).getTime(),
            close: parseFloat(values['5. adjusted close']),
            high: parseFloat(values['2. high']),
            low: parseFloat(values['3. low']),
            open: parseFloat(values['1. open']),
          }))
          .filter((item: any) => item.close > 0)
          .sort((a: any, b: any) => a.timestamp - b.timestamp) // Ensure chronological order
        if (chartData.length > 0) return { data: chartData }
      }
    } catch (error) {
      console.log('Alpha Vantage candles failed')
    }
  }

  return { data: [] }
}

export async function getCompanyNews(symbol: string): Promise<NewsItem[]> {
  const today = new Date()
  const fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const from = fromDate.toISOString().split('T')[0]
  const to = today.toISOString().split('T')[0]

  // Try Finnhub company news first
  if (FINNHUB_KEY) {
    try {
      const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
      const data = await fetchJSON(url, 2000)
      if (Array.isArray(data) && data.length > 0) {
        return data.slice(0, 10).map((item: any) => ({
          id: String(item.id),
          datetime: item.datetime,
          headline: item.headline,
          source: item.source,
          url: item.url,
          image: item.image,
          summary: item.summary,
        }))
      }
    } catch (error) {
      console.log('Finnhub company news failed, trying general news')
    }

    // Fallback to general news and filter
    try {
      const url = `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`
      const data = await fetchJSON(url, 2000)
      if (Array.isArray(data)) {
        return data
          .filter((item: any) => 
            item.headline?.toUpperCase().includes(symbol.toUpperCase()) ||
            item.related?.includes(symbol.toUpperCase())
          )
          .slice(0, 10)
          .map((item: any) => ({
            id: String(item.id),
            datetime: item.datetime,
            headline: item.headline,
            source: item.source,
            url: item.url,
            image: item.image,
            summary: item.summary,
          }))
      }
    } catch (error) {
      console.log('Finnhub general news failed')
    }
  }

  return []
}

