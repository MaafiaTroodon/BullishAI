import axios from 'axios'

export interface YahooQuote {
  price: number
  change: number
  changePct: number
  open: number
  high: number
  low: number
  previousClose: number
  volume: number
  marketCap: number
  peRatio?: number
  week52High?: number
  week52Low?: number
}

export async function getYahooQuote(symbol: string): Promise<YahooQuote> {
  try {
    // Fetch both chart data and summary for complete info
    const [chartResponse, summaryResponse] = await Promise.allSettled([
      axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`, { timeout: 5000 }),
      axios.get(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=summaryProfile,summaryDetail`, { timeout: 5000 })
    ])
    
    const response = chartResponse.status === 'fulfilled' ? chartResponse.value : null
    const summary = summaryResponse.status === 'fulfilled' ? summaryResponse.value : null
    
    // Helper function to extract market cap with fallback calculation
    const getMarketCap = (price: number, summaryData: any) => {
      if (summaryData?.quoteSummary?.result?.[0]?.summaryDetail?.marketCap?.raw) {
        return summaryData.quoteSummary.result[0].summaryDetail.marketCap.raw
      }
      
      // Fallback: calculate from shares outstanding
      const sharesOutstanding = summaryData?.quoteSummary?.result?.[0]?.summaryDetail?.sharesOutstanding?.raw
      if (sharesOutstanding) {
        return price * sharesOutstanding
      }
      
      return 0
    }
    
    if (response.data?.chart?.result?.[0]?.meta) {
      const meta = response.data.chart.result[0].meta
      
      // Get latest quote data
      const indicators = response.data.chart.result[0].indicators?.quote?.[0]
      const timestamps = response.data.chart.result[0].timestamp
      
      if (meta.regularMarketPrice && meta.regularMarketPrice > 0) {
        const price = meta.regularMarketPrice
        const previousClose = meta.chartPreviousClose || meta.regularMarketPreviousClose || price
        
        // Calculate change and change percent
        const change = price - previousClose
        const changePct = (change / previousClose) * 100
        
        // Extract market cap using helper
        const marketCap = getMarketCap(price, summary?.data)
        
        const peRatio = meta.trailingPE || summary?.data?.quoteSummary?.result?.[0]?.summaryDetail?.trailingPE?.raw
        const week52High = meta.fiftyTwoWeekHigh || summary?.data?.quoteSummary?.result?.[0]?.summaryDetail?.fiftyTwoWeekHigh?.raw
        const week52Low = meta.fiftyTwoWeekLow || summary?.data?.quoteSummary?.result?.[0]?.summaryDetail?.fiftyTwoWeekLow?.raw
        
        return {
          price,
          change,
          changePct,
          open: meta.regularMarketOpen || price,
          high: meta.regularMarketDayHigh || meta.regularMarketPrice || 0,
          low: meta.regularMarketDayLow || meta.regularMarketPrice || 0,
          previousClose,
          volume: meta.regularMarketVolume || 0,
          marketCap,
          peRatio,
          week52High,
          week52Low,
        }
      } else if (indicators && timestamps.length > 0) {
        const lastIdx = timestamps.length - 1
        const price = indicators.close[lastIdx]
        const previousClose = meta.chartPreviousClose || meta.regularMarketPreviousClose || price
        const change = price - previousClose
        const changePct = (change / previousClose) * 100
        
        // Extract market cap using helper
        const marketCap = getMarketCap(price, summary?.data)
        
        const peRatio = meta.trailingPE || summary?.data?.quoteSummary?.result?.[0]?.summaryDetail?.trailingPE?.raw
        const week52High = meta.fiftyTwoWeekHigh || summary?.data?.quoteSummary?.result?.[0]?.summaryDetail?.fiftyTwoWeekHigh?.raw
        const week52Low = meta.fiftyTwoWeekLow || summary?.data?.quoteSummary?.result?.[0]?.summaryDetail?.fiftyTwoWeekLow?.raw
        
        return {
          price,
          change,
          changePct,
          open: indicators.open[lastIdx] || price,
          high: Math.max(...indicators.high.filter((h: number) => h != null && h > 0)),
          low: Math.min(...indicators.low.filter((l: number) => l != null && l > 0)),
          previousClose,
          volume: indicators.volume[lastIdx] || 0,
          marketCap,
          peRatio,
          week52High,
          week52Low,
        }
      }
    }
    
    throw new Error('Invalid Yahoo response')
  } catch (error: any) {
    console.log('Yahoo Finance quote failed:', error.message)
    throw error
  }
}

