import axios from 'axios'
import * as cheerio from 'cheerio'

export interface GoogleFinanceQuote {
  price: number
  change: number
  changePct: number
  marketCap: number
  peRatio?: number
  volume: number
  high?: number
  low?: number
  open?: number
  previousClose?: number
  source: string
}

// Fetch quote from Google Finance using their API
export async function fetchFromGoogleFinance(symbol: string): Promise<GoogleFinanceQuote | null> {
  try {
    // Try the Google Finance API endpoint
    const response = await axios.get(
      `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}`,
      { 
        params: { interval: '1d', range: '1d' },
        timeout: 3000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    )

    if (response.data?.chart?.result?.[0]?.meta) {
      const meta = response.data.chart.result[0].meta
      
      if (meta.regularMarketPrice && meta.regularMarketPrice > 0) {
        const price = meta.regularMarketPrice
        const previousClose = meta.chartPreviousClose || meta.regularMarketPreviousClose || price
        const change = price - previousClose
        const changePct = (change / previousClose) * 100

        // Try to get market cap from summary
        let marketCap = 0
        try {
          const summaryResponse = await axios.get(
            `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=summaryDetail`,
            { timeout: 3000 }
          )
          
          if (summaryResponse.data?.quoteSummary?.result?.[0]?.summaryDetail?.marketCap?.raw) {
            marketCap = summaryResponse.data.quoteSummary.result[0].summaryDetail.marketCap.raw
          } else if (summaryResponse.data?.quoteSummary?.result?.[0]?.summaryDetail?.sharesOutstanding?.raw) {
            marketCap = price * summaryResponse.data.quoteSummary.result[0].summaryDetail.sharesOutstanding.raw
          }
        } catch (e) {
          // Ignore summary fetch error
        }

        return {
          price,
          change,
          changePct,
          marketCap,
          volume: meta.regularMarketVolume || 0,
          high: meta.regularMarketDayHigh,
          low: meta.regularMarketDayLow,
          open: meta.regularMarketOpen,
          previousClose,
          peRatio: meta.trailingPE,
          source: 'Google Finance'
        }
      }
    }
    
    return null
  } catch (error: any) {
    console.log('Google Finance fetch failed:', error.message)
    return null
  }
}

// Fetch market cap specifically from Google Finance
export async function fetchMarketCapFromGoogle(symbol: string, priceUSD?: number): Promise<number> {
  try {
    const response = await axios.get(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=summaryDetail`,
      { timeout: 3000 }
    )

    if (response.data?.quoteSummary?.result?.[0]) {
      const data = response.data.quoteSummary.result[0]
      
      // Try marketCap first
      let marketCap = data.summaryDetail?.marketCap?.raw
      
      if (!marketCap && priceUSD && data.summaryDetail?.sharesOutstanding?.raw) {
        marketCap = priceUSD * data.summaryDetail.sharesOutstanding.raw
      }

      if (marketCap && marketCap > 0) {
        return marketCap
      }
    }
    
    return 0
  } catch (error: any) {
    console.log(`Google Finance market cap failed for ${symbol}`)
    return 0
  }
}

