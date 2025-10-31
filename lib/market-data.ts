import axios from 'axios'

const FINNHUB_KEY = process.env.FINNHUB_API_KEY
const TWELVEDATA_KEY = process.env.TWELVEDATA_API_KEY
const ALPHAVANTAGE_KEY = process.env.ALPHAVANTAGE_API_KEY
const FMP_KEY = process.env.FINANCIALMODELINGPREP_API_KEY
const TIINGO_KEY = process.env.TIINGO_API_KEY

export interface Candle {
  t: number  // UTC timestamp in ms
  o: number  // open
  h: number  // high
  l: number  // low
  c: number  // close
  v: number | null  // volume (null if unavailable)
}

// Retry with exponential backoff
async function fetchWithRetry(url: string, maxRetries = 3, timeout = 6000): Promise<any> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.get(url, { signal: controller.signal, timeout })
      clearTimeout(timeoutId)
      return response.data
    } catch (error: any) {
      if (attempt === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 250 * Math.pow(2, attempt)))
    }
  }
  clearTimeout(timeoutId)
  throw new Error('Max retries exceeded')
}

// Yahoo Finance (no key required, very reliable)
async function fetchYahoo(symbol: string, range: string): Promise<Candle[]> {
  const rangeMap: Record<string, string> = {
    '1h': '1d&interval=1m',
    '1d': '1d&interval=5m',
    '3d': '5d&interval=15m',
    '1week': '5d&interval=1h',
    '1m': '1mo&interval=1d',
    '3m': '3mo&interval=1d',
    '6m': '6mo&interval=1d',
    '1y': '1y&interval=1d',
    '5y': '5y&interval=1wk',
  }
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${rangeMap[range] || '1d&interval=5m'}`
  const data = await fetchWithRetry(url)
  
  if (data.chart?.result?.[0]?.indicators?.quote?.[0]) {
    const quotes = data.chart.result[0].indicators.quote[0]
    const timestamps = data.chart.result[0].timestamp
    
    return timestamps.map((t: number, i: number) => ({
      t: t * 1000, // Convert to ms
      o: quotes.open[i],
      h: quotes.high[i],
      l: quotes.low[i],
      c: quotes.close[i],
      v: quotes.volume[i] || null,
    })).filter((c: Candle) => c.o != null && c.h != null && c.l != null && c.c != null)
  }
  
  throw new Error('Invalid Yahoo response')
}

// Twelve Data
async function fetchTwelveData(symbol: string, range: string): Promise<Candle[]> {
  if (!TWELVEDATA_KEY) throw new Error('No Twelve Data key')
  
  const intervalMap: Record<string, string> = {
    '1h': '1min',
    '1d': '1min',
    '3d': '5min',
    '1week': '1hour',
    '1m': '1day',
    '3m': '1day',
    '6m': '1day',
    '1y': '1day',
    '5y': '1week',
  }
  
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${intervalMap[range]}&outputsize=200&apikey=${TWELVEDATA_KEY}`
  const data = await fetchWithRetry(url)
  
  if (data.values) {
    return data.values
      .map((item: any) => ({
        t: new Date(item.datetime).getTime(),
        o: parseFloat(item.open),
        h: parseFloat(item.high),
        l: parseFloat(item.low),
        c: parseFloat(item.close),
        v: item.volume ? parseFloat(item.volume) : null,
      }))
      .sort((a: Candle, b: Candle) => a.t - b.t)
  }
  
  throw new Error('Invalid Twelve Data response')
}

// Financial Modeling Prep
async function fetchFMP(symbol: string, range: string): Promise<Candle[]> {
  if (!FMP_KEY) throw new Error('No FMP key')
  
  // FMP is daily/weekly data
  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?apikey=${FMP_KEY}`
  const data = await fetchWithRetry(url)
  
  if (data.historical && data.historical.length > 0) {
    return data.historical
      .slice(0, 365) // Limit to 1 year for speed
      .map((item: any) => ({
        t: new Date(item.date).getTime(),
        o: item.open,
        h: item.high,
        l: item.low,
        c: item.close,
        v: item.volume || null,
      }))
      .sort((a: Candle, b: Candle) => a.t - b.t)
  }
  
  throw new Error('Invalid FMP response')
}

// Tiingo
async function fetchTiingo(symbol: string): Promise<Candle[]> {
  if (!TIINGO_KEY) throw new Error('No Tiingo key')
  
  const url = `https://api.tiingo.com/tiingo/daily/${symbol}/prices?token=${TIINGO_KEY}`
  const data = await fetchWithRetry(url)
  
  if (data && data.length > 0) {
    return data
      .slice(0, 365)
      .map((item: any) => ({
        t: new Date(item.date).getTime(),
        o: item.open,
        h: item.high,
        l: item.low,
        c: item.close,
        v: item.volume || null,
      }))
      .sort((a: Candle, b: Candle) => a.t - b.t)
  }
  
  throw new Error('Invalid Tiingo response')
}

// Main function with automatic fallback
export async function getCandles(symbol: string, range: string): Promise<{ data: Candle[], source: string }> {
  // Normalize symbol (e.g., "INTEL" -> "INTC")
  const symbolMap: Record<string, string> = {
    'INTEL': 'INTC',
    'MICROSOFT': 'MSFT',
    'GOOGLE': 'GOOGL',
    'ALPHABET': 'GOOGL',
  }
  
  const normalizedSymbol = symbolMap[symbol.toUpperCase()] || symbol.toUpperCase()
  
  const providers = range === '1d' || range === '5d' 
    ? [
        { name: 'Yahoo', fn: () => fetchYahoo(normalizedSymbol, range) },
        { name: 'Twelve Data', fn: () => fetchTwelveData(normalizedSymbol, range) },
      ]
    : [
        { name: 'Yahoo', fn: () => fetchYahoo(normalizedSymbol, range) },
        { name: 'Twelve Data', fn: () => fetchTwelveData(normalizedSymbol, range) },
        { name: 'Financial Modeling Prep', fn: () => fetchFMP(normalizedSymbol, range) },
        { name: 'Tiingo', fn: () => fetchTiingo(normalizedSymbol) },
      ]
  
  let lastError: Error | null = null
  
  for (const provider of providers) {
    try {
      const candles = await provider.fn()
      if (candles && candles.length > 0) {
        return { data: candles, source: provider.name }
      }
    } catch (error: any) {
      console.log(`${provider.name} failed: ${error.message}`)
      lastError = error
      continue
    }
  }
  
  throw new Error(`All providers failed for ${symbol}`)
}

