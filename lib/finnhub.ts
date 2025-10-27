import axios from 'axios'

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY

interface QuoteResponse {
  c: number // current price
  d: number // change
  dp: number // percent change
  h: number // high
  l: number // low
  o: number // open
  pc: number // previous close
  t: number // timestamp
}

export async function getQuote(symbol: string): Promise<QuoteResponse | null> {
  if (!FINNHUB_API_KEY) return null

  try {
    const response = await axios.get('https://finnhub.io/api/v1/quote', {
      params: {
        symbol,
        token: FINNHUB_API_KEY,
      },
    })
    return response.data
  } catch (error: any) {
    if (error.response?.status === 429) {
      throw new Error('RATE_LIMIT')
    }
    throw error
  }
}

export async function getCompanyNews(symbol: string, limit = 5) {
  if (!FINNHUB_API_KEY) return []

  try {
    const from = new Date()
    from.setDate(from.getDate() - 7)
    
    const response = await axios.get('https://finnhub.io/api/v1/company-news', {
      params: {
        symbol,
        from: from.toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        token: FINNHUB_API_KEY,
      },
    })
    return response.data.slice(0, limit) || []
  } catch (error: any) {
    if (error.response?.status === 429) {
      throw new Error('RATE_LIMIT')
    }
    throw error
  }
}

export async function searchSymbol(query: string) {
  if (!FINNHUB_API_KEY) return []

  try {
    const response = await axios.get('https://finnhub.io/api/v1/search', {
      params: {
        q: query,
        token: FINNHUB_API_KEY,
      },
    })
    return response.data.result || []
  } catch (error: any) {
    if (error.response?.status === 429) {
      throw new Error('RATE_LIMIT')
    }
    throw error
  }
}

export async function getHistoricalData(
  symbol: string,
  resolution: string,
  from: number,
  to: number
) {
  if (!FINNHUB_API_KEY) return []

  try {
    const response = await axios.get('https://finnhub.io/api/v1/stock/candle', {
      params: {
        symbol,
        resolution,
        from,
        to,
        token: FINNHUB_API_KEY,
      },
    })
    return response.data
  } catch (error: any) {
    if (error.response?.status === 429) {
      throw new Error('RATE_LIMIT')
    }
    throw error
  }
}

