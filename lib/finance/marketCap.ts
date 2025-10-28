import axios from 'axios'
import { fetchMarketCapFromGoogle } from '../google-finance'

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_KEY
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY || process.env.NEXT_PUBLIC_TWELVEDATA_KEY
const FMP_KEY = process.env.FINANCIALMODELINGPREP_API_KEY

export interface MarketCapResult {
  raw: number | null
  source: string
  note?: string
}

// In-memory cache (15 minutes)
const cache = new Map<string, { value: MarketCapResult; timestamp: number }>()
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

// Formatter utility
export function formatMarketCapShort(raw: number): string {
  const abs = Math.abs(raw)
  
  if (abs < 1_000_000) {
    return `${(raw / 1_000).toFixed(0)}K`
  } else if (abs < 1_000_000_000) {
    return `${(raw / 1_000_000).toFixed(2)}M`
  } else if (abs < 1_000_000_000_000) {
    return `${(raw / 1_000_000_000).toFixed(2)}B`
  } else {
    return `${(raw / 1_000_000_000_000).toFixed(2)}T`
  }
}

export function formatMarketCapFull(raw: number): string {
  const abs = Math.abs(raw)
  
  if (abs < 1_000_000) {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(raw)
  } else if (abs < 1_000_000_000) {
    return `${new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(raw / 1_000_000)}M`
  } else if (abs < 1_000_000_000_000) {
    return `${new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(raw / 1_000_000_000)}B`
  } else {
    return `${new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(raw / 1_000_000_000_000)}T`
  }
}

// Known large caps (sanity check)
const LARGE_CAPS = new Set(['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'GOOG', 'META', 'TSLA', 'AMD', 'NFLX', 'ORCL', 'CRM', 'AVGO', 'ADBE'])

export async function resolveMarketCapUSD(symbol: string, priceUSD?: number): Promise<MarketCapResult> {
  // Check cache
  const cached = cache.get(symbol)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value
  }

  let result: MarketCapResult = { raw: null, source: 'none' }

  // 1. Try Yahoo Finance
  try {
    const yahooResponse = await axios.get(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=summaryDetail,price`,
      { timeout: 3000 }
    )

    if (yahooResponse.data?.quoteSummary?.result?.[0]) {
      const yahooData = yahooResponse.data.quoteSummary.result[0]
      
      // Try marketCap from price module first
      // Yahoo Finance might return in different units, so we check
      let marketCapRaw = yahooData.price?.marketCap?.raw
      
      // Fallback to summaryDetail
      if (!marketCapRaw) {
        marketCapRaw = yahooData.summaryDetail?.marketCap?.raw
      }

      // Fallback: calculate from shares outstanding
      if (!marketCapRaw && priceUSD && yahooData.summaryDetail?.sharesOutstanding?.raw) {
        marketCapRaw = priceUSD * yahooData.summaryDetail.sharesOutstanding.raw
      }

      // Sanity check: Yahoo's raw is already in USD
      // But if value seems unreasonably large (> 100T), it might be in wrong units
      if (marketCapRaw && marketCapRaw > 1e15) {
        // Value too large, likely needs to be adjusted
        // Just skip for now and try fallback
        marketCapRaw = 0
      }

      if (marketCapRaw && marketCapRaw > 0) {
        result = {
          raw: marketCapRaw,
          source: 'yahoo'
        }
      }
    }
  } catch (error) {
    console.log(`Yahoo market cap failed for ${symbol}`)
  }

  // 2. If not found or sanity failed, try Finnhub
  if (!result.raw || (LARGE_CAPS.has(symbol) && result.raw < 5e9)) {
    try {
      if (FINNHUB_KEY) {
        const finnhubResponse = await axios.get(
          `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`,
          { timeout: 3000 }
        )

        if (finnhubResponse.data?.metric?.marketCapitalization) {
          // Finnhub marketCapitalization is in raw USD (already correct)
          const marketCapRaw = finnhubResponse.data.metric.marketCapitalization

          if (marketCapRaw > 0 && (!LARGE_CAPS.has(symbol) || marketCapRaw >= 5e9)) {
            result = {
              raw: marketCapRaw,
              source: 'finnhub'
            }
          }
        }
      }
    } catch (error) {
      console.log(`Finnhub market cap failed for ${symbol}`)
    }
  }

  // 3. If still not found, try Financial Modeling Prep
  if (!result.raw || (LARGE_CAPS.has(symbol) && result.raw < 5e9)) {
    try {
      if (FMP_KEY) {
        const fmpResponse = await axios.get(
          `https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${FMP_KEY}`,
          { timeout: 3000 }
        )

        if (fmpResponse.data && fmpResponse.data[0]?.mktCap) {
          const marketCapRaw = fmpResponse.data[0].mktCap
          if (marketCapRaw > 0 && (!LARGE_CAPS.has(symbol) || marketCapRaw >= 5e9)) {
            result = {
              raw: marketCapRaw,
              source: 'fmp'
            }
          }
        }
      }
    } catch (error) {
      console.log(`FMP market cap failed for ${symbol}`)
    }
  }

  // 4. Last resort: Try Twelve Data
  if (!result.raw || (LARGE_CAPS.has(symbol) && result.raw < 5e9)) {
    try {
      if (TWELVE_DATA_KEY) {
        const twelveResponse = await axios.get(
          `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_KEY}`,
          { timeout: 3000 }
        )

        if (twelveResponse.data?.market_cap) {
          const marketCapRaw = parseFloat(twelveResponse.data.market_cap)
          if (marketCapRaw > 0) {
            result = {
              raw: marketCapRaw,
              source: 'twelvedata'
            }
          }
        }
      }
    } catch (error) {
      console.log(`Twelve Data market cap failed for ${symbol}`)
    }
  }

  // 5. Final fallback: Try Google Finance
  if (!result.raw || (LARGE_CAPS.has(symbol) && result.raw < 5e9)) {
    try {
      const googleMarketCap = await fetchMarketCapFromGoogle(symbol, priceUSD)
      if (googleMarketCap > 0 && (!LARGE_CAPS.has(symbol) || googleMarketCap >= 5e9)) {
        result = {
          raw: googleMarketCap,
          source: 'google-finance'
        }
      }
    } catch (error) {
      console.log(`Google Finance market cap failed for ${symbol}`)
    }
  }

  // Cache the result
  cache.set(symbol, { value: result, timestamp: Date.now() })

  return result
}

