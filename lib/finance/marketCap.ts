import axios from 'axios'

// In-memory cache (15 minutes TTL)
const cache = new Map<string, { value: number | null; source: string; timestamp: number }>()
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

function shortenMarketCap(billions: number): string {
  if (billions < 0.001) {
    return `${(billions * 1000).toFixed(1)}M`
  } else if (billions < 1) {
    return `${billions.toFixed(2)}B`
  } else if (billions < 1000) {
    return `${billions.toFixed(2)}B`
  } else {
    return `${(billions / 1000).toFixed(2)}T`
  }
}

export async function resolveMarketCap(
  symbol: string,
  price?: number
): Promise<{ raw: number | null; short: string | null; source: string }> {
  // Check cache first
  const cached = cache.get(symbol)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      raw: cached.value,
      short: cached.value ? shortenMarketCap(cached.value / 1e9) : null,
      source: cached.source,
    }
  }

  const FINNHUB_KEY = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_KEY
  const TWELVE_DATA_KEY = process.env.TWELVEDATA_API_KEY
  const FMP_KEY = process.env.FINANCIALMODELINGPREP_API_KEY

  let source = 'none'
  let marketCapValue: number | null = null

  // Try 1: Finnhub
  if (FINNHUB_KEY && !marketCapValue) {
    try {
      const response = await axios.get(
        `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`,
        { timeout: 3000 }
      )
      const metric = response.data?.metric?.marketCapitalization
      if (metric && typeof metric === 'number' && metric > 0) {
        marketCapValue = metric * 1e9 // Finnhub returns in billions
        source = 'finnhub'
      }
    } catch (error) {
      console.log(`Finnhub market cap failed for ${symbol}:`, error)
    }
  }

  // Try 2: TwelveData
  if (!marketCapValue && TWELVE_DATA_KEY) {
    try {
      const response = await axios.get(
        `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_KEY}`,
        { timeout: 3000 }
      )
      const capStr = response.data?.market_cap
      if (capStr) {
        const parsed = parseFloat(capStr.replace(/,/g, ''))
        if (parsed && !isNaN(parsed)) {
          marketCapValue = parsed
          source = 'twelvedata'
        }
      }
    } catch (error) {
      console.log(`TwelveData market cap failed for ${symbol}:`, error)
    }
  }

  // Try 3: Yahoo Finance
  if (!marketCapValue) {
    try {
      const response = await axios.get(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price,summaryDetail,defaultKeyStatistics`,
        { timeout: 3000 }
      )
      
      if (response.data?.quoteSummary?.result?.[0]) {
        const data = response.data.quoteSummary.result[0]
        
        // Try multiple sources in Yahoo
        if (data.price?.marketCap?.raw) {
          marketCapValue = data.price.marketCap.raw
          source = 'yahoo'
        } else if (data.summaryDetail?.marketCap?.raw) {
          marketCapValue = data.summaryDetail.marketCap.raw
          source = 'yahoo'
        } else if (data.defaultKeyStatistics?.marketCap?.raw) {
          marketCapValue = data.defaultKeyStatistics.marketCap.raw
          source = 'yahoo'
        }
      }
    } catch (error) {
      console.log(`Yahoo Finance market cap failed for ${symbol}:`, error)
    }
  }

  // Try 4: Financial Modeling Prep
  if (!marketCapValue && FMP_KEY) {
    try {
      const response = await axios.get(
        `https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${FMP_KEY}`,
        { timeout: 3000 }
      )
      
      if (response.data && response.data[0]?.mktCap && response.data[0].mktCap > 0) {
        marketCapValue = response.data[0].mktCap
        source = 'fmp'
      }
    } catch (error) {
      console.log(`FMP market cap failed for ${symbol}:`, error)
    }
  }

  // Try 5: Computed fallback
  if (!marketCapValue && price && price > 0) {
    try {
      // Try to get shares outstanding from Finnhub
      if (FINNHUB_KEY) {
        const response = await axios.get(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`,
          { timeout: 3000 }
        )
        
        const sharesOutstanding = response.data?.shareOutstanding
        if (sharesOutstanding && sharesOutstanding > 0) {
          marketCapValue = sharesOutstanding * price
          source = 'computed'
        }
      }
    } catch (error) {
      console.log(`Computed market cap failed for ${symbol}:`, error)
    }
  }

  // Cache the result
  cache.set(symbol, {
    value: marketCapValue,
    source,
    timestamp: Date.now(),
  })

  return {
    raw: marketCapValue,
    short: marketCapValue ? shortenMarketCap(marketCapValue / 1e9) : null,
    source,
  }
}

