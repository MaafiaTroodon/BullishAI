import axios from 'axios'

const FINNHUB_KEY = process.env.FINNHUB_API_KEY
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY
const ALPHAVANTAGE_KEY = process.env.ALPHAVANTAGE_API_KEY
const FMP_KEY = process.env.FINANCIALMODELINGPREP_API_KEY
const TIINGO_KEY = process.env.TIINGO_API_KEY || process.env.NEXT_PUBLIC_TIINGO_API_KEY

export interface ComprehensiveQuote {
  price: number
  change: number
  changePct: number
  open?: number
  high?: number
  low?: number
  previousClose?: number
  volume?: number
  marketCap: number
  peRatio?: number
  week52High?: number
  week52Low?: number
  source: string
}

// Fetch from Yahoo Finance
async function fetchFromYahoo(symbol: string): Promise<ComprehensiveQuote | null> {
  try {
    const [chartResponse, summaryResponse] = await Promise.allSettled([
      axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`, { timeout: 3000 }),
      axios.get(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=summaryProfile,summaryDetail`, { timeout: 3000 })
    ])
    
    const response = chartResponse.status === 'fulfilled' ? chartResponse.value : null
    const summary = summaryResponse.status === 'fulfilled' ? summaryResponse.value : null
    
    if (response?.data?.chart?.result?.[0]?.meta) {
      const meta = response.data.chart.result[0].meta
      
      if (meta.regularMarketPrice && meta.regularMarketPrice > 0) {
        const price = meta.regularMarketPrice
        const previousClose = meta.chartPreviousClose || meta.regularMarketPreviousClose || price
        const change = price - previousClose
        const changePct = (change / previousClose) * 100
        
        // Get market cap from summary
        let marketCap = 0
        if (summary?.data?.quoteSummary?.result?.[0]?.summaryDetail?.marketCap?.raw) {
          marketCap = summary.data.quoteSummary.result[0].summaryDetail.marketCap.raw
        } else if (summary?.data?.quoteSummary?.result?.[0]?.summaryDetail?.sharesOutstanding?.raw) {
          marketCap = price * summary.data.quoteSummary.result[0].summaryDetail.sharesOutstanding.raw
        }
        
        return {
          price,
          change,
          changePct,
          open: meta.regularMarketOpen,
          high: meta.regularMarketDayHigh,
          low: meta.regularMarketDayLow,
          previousClose,
          volume: meta.regularMarketVolume,
          marketCap,
          peRatio: meta.trailingPE || summary?.data?.quoteSummary?.result?.[0]?.summaryDetail?.trailingPE?.raw,
          week52High: meta.fiftyTwoWeekHigh || summary?.data?.quoteSummary?.result?.[0]?.summaryDetail?.fiftyTwoWeekHigh?.raw,
          week52Low: meta.fiftyTwoWeekLow || summary?.data?.quoteSummary?.result?.[0]?.summaryDetail?.fiftyTwoWeekLow?.raw,
          source: 'Yahoo Finance'
        }
      }
    }
    return null
  } catch (error: any) {
    console.log('Yahoo fetch failed:', error.message)
    return null
  }
}

// Fetch from Finnhub
async function fetchFromFinnhub(symbol: string): Promise<ComprehensiveQuote | null> {
  if (!FINNHUB_KEY) return null
  
  try {
    const response = await axios.get(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`,
      { timeout: 3000 }
    )
    
    if (response.data && response.data.c) {
      const price = response.data.c
      const previousClose = response.data.pc || price
      const change = price - previousClose
      const changePct = (change / previousClose) * 100
      
      // Get detailed info from company profile
      try {
        const profileResponse = await axios.get(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`,
          { timeout: 3000 }
        )
        
        const marketCap = profileResponse.data?.marketCapitalization || 0
        
        return {
          price,
          change,
          changePct,
          high: response.data.h,
          low: response.data.l,
          open: response.data.o,
          previousClose,
          marketCap,
          source: 'Finnhub'
        }
      } catch {
        return {
          price,
          change,
          changePct,
          high: response.data.h,
          low: response.data.l,
          open: response.data.o,
          previousClose,
          marketCap: 0,
          source: 'Finnhub'
        }
      }
    }
    return null
  } catch (error: any) {
    console.log('Finnhub fetch failed:', error.message)
    return null
  }
}

// Fetch from Twelve Data
async function fetchFromTwelve(symbol: string): Promise<ComprehensiveQuote | null> {
  if (!TWELVE_DATA_KEY) return null
  
  try {
    const response = await axios.get(
      `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_KEY}`,
      { timeout: 3000 }
    )
    
    if (response.data && response.data.close) {
      const price = parseFloat(response.data.close)
      const open = parseFloat(response.data.open)
      const high = parseFloat(response.data.high)
      const low = parseFloat(response.data.low)
      const previousClose = parseFloat(response.data.previous_close)
      const change = price - previousClose
      const changePct = (change / previousClose) * 100
      
      return {
        price,
        change,
        changePct,
        open,
        high,
        low,
        previousClose,
        volume: parseFloat(response.data.volume || '0'),
        marketCap: 0, // Twelve Data doesn't provide market cap
        source: 'Twelve Data'
      }
    }
    return null
  } catch (error: any) {
    console.log('Twelve Data fetch failed:', error.message)
    return null
  }
}

// Fetch from Alpha Vantage
async function fetchFromAlphaVantage(symbol: string): Promise<ComprehensiveQuote | null> {
  if (!ALPHAVANTAGE_KEY) return null
  
  try {
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHAVANTAGE_KEY}`,
      { timeout: 3000 }
    )
    
    if (response.data?.['Global Quote']?.['05. price']) {
      const quote = response.data['Global Quote']
      const price = parseFloat(quote['05. price'])
      const previousClose = parseFloat(quote['08. previous close'])
      const change = parseFloat(quote['09. change'])
      const changePct = parseFloat(quote['10. change percent'].replace('%', ''))
      
      return {
        price,
        change,
        changePct,
        open: parseFloat(quote['02. open']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        previousClose,
        volume: parseFloat(quote['06. volume']),
        marketCap: 0, // Alpha Vantage doesn't provide market cap
        source: 'Alpha Vantage'
      }
    }
    return null
  } catch (error: any) {
    console.log('Alpha Vantage fetch failed:', error.message)
    return null
  }
}

// Fetch from Financial Modeling Prep
async function fetchFromFMP(symbol: string): Promise<ComprehensiveQuote | null> {
  if (!FMP_KEY) return null
  
  try {
    const response = await axios.get(
      `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_KEY}`,
      { timeout: 3000 }
    )
    
    if (response.data && response.data[0] && response.data[0].price) {
      const data = response.data[0]
      const price = data.price
      const previousClose = data.previousClose || price
      const change = price - previousClose
      const changePct = (change / previousClose) * 100
      
      return {
        price,
        change,
        changePct,
        open: data.open,
        high: data.dayHigh,
        low: data.dayLow,
        previousClose,
        volume: data.volume,
        marketCap: data.marketCap || 0,
        peRatio: data.pe,
        week52High: data.yearHigh,
        week52Low: data.yearLow,
        source: 'FinancialModelingPrep'
      }
    }
    return null
  } catch (error: any) {
    console.log('FMP fetch failed:', error.message)
    return null
  }
}

// Fetch from Tiingo for market cap
async function fetchMarketCapFromTiingo(symbol: string): Promise<number> {
  if (!TIINGO_KEY) return 0
  
  try {
    const response = await axios.get(
      `https://api.tiingo.com/tiingo/daily/${symbol}?token=${TIINGO_KEY}`,
      { timeout: 3000 }
    )
    
    // Tiingo doesn't directly provide market cap, but we can get shares outstanding
    if (response.data && response.data[0]) {
      // Try to get market cap from fundamentals
      try {
        const fundResponse = await axios.get(
          `https://api.tiingo.com/tiingo/fundamentals/${symbol}?token=${TIINGO_KEY}`,
          { timeout: 3000 }
        )
        
        const shares = fundResponse.data?.[0]?.sharesOutstanding
        const price = response.data[0]?.adjClose || response.data[0]?.close
        
        if (shares && price) {
          return shares * price
        }
      } catch {
        // Fallback calculation not available
      }
    }
    return 0
  } catch (error: any) {
    console.log('Tiingo fetch failed:', error.message)
    return 0
  }
}

// Main function that tries all sources
export async function getComprehensiveQuote(symbol: string): Promise<ComprehensiveQuote> {
  // Try all sources in parallel
  const results = await Promise.allSettled([
    fetchFromYahoo(symbol),
    fetchFromFinnhub(symbol),
    fetchFromTwelve(symbol),
    fetchFromAlphaVantage(symbol),
    fetchFromFMP(symbol),
  ])
  
  // Collect successful results
  const successfulQuotes: ComprehensiveQuote[] = []
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      successfulQuotes.push(result.value)
    }
  }
  
  if (successfulQuotes.length === 0) {
    throw new Error(`Unable to fetch quote for ${symbol} from any source`)
  }
  
  // Use the first successful result but merge market cap from any source that has it
  let bestQuote = successfulQuotes[0]
  
  // Merge data: prioritize non-zero values
  for (const quote of successfulQuotes) {
    // If current quote doesn't have market cap but another does, use it
    if (bestQuote.marketCap === 0 && quote.marketCap > 0) {
      bestQuote.marketCap = quote.marketCap
    }
    
    // Fill in missing fields
    if (!bestQuote.peRatio && quote.peRatio) {
      bestQuote.peRatio = quote.peRatio
    }
    if (!bestQuote.week52High && quote.week52High) {
      bestQuote.week52High = quote.week52High
    }
    if (!bestQuote.week52Low && quote.week52Low) {
      bestQuote.week52Low = quote.week52Low
    }
    if (!bestQuote.volume && quote.volume) {
      bestQuote.volume = quote.volume
    }
    if (!bestQuote.open && quote.open) {
      bestQuote.open = quote.open
    }
    if (!bestQuote.high && quote.high) {
      bestQuote.high = quote.high
    }
    if (!bestQuote.low && quote.low) {
      bestQuote.low = quote.low
    }
  }
  
  // If we still don't have market cap, try to fetch from Tiingo
  if (bestQuote.marketCap === 0) {
    const tiingoMarketCap = await fetchMarketCapFromTiingo(symbol)
    if (tiingoMarketCap > 0) {
      bestQuote.marketCap = tiingoMarketCap
      bestQuote.source += ', Tiingo'
    } else {
      console.log(`Warning: Could not fetch market cap for ${symbol}`)
    }
  }
  
  bestQuote.source = successfulQuotes.map(q => q.source).join(', ')
  return bestQuote
}

