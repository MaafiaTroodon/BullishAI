import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth-server'
import { loadPortfolioFromDB } from '@/lib/db-sql'
import { getSectionsForRange } from '@/lib/portfolio-snapshots'
import { getCandles } from '@/lib/market-data'
import { getQuoteWithFallback } from '@/lib/providers/market-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/portfolio/timeseries-calculated
 * Calculates portfolio value over time using CURRENT HOLDINGS + real-time/historical prices
 * 
 * Formula: portfolioValue = sum(shares_i * price_i_at_that_time) for all holdings
 * 
 * This endpoint:
 * 1. Gets CURRENT holdings from DB (positions table with symbol, totalShares, avgPrice, totalCost)
 * 2. For each time point in the range, fetches price at that time for each holding
 * 3. Calculates portfolio value = sum(price_at_that_time * shares) for all holdings
 * 4. Uses real-time prices for recent points to show live market movements
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const rawRange = url.searchParams.get('range') || '1d'
    
    // Map API range names to internal range names
    const rangeMap: Record<string, string> = {
      '1h': '1h',
      '60m': '1h',
      '1hour': '1h',
      '1d': '1d',
      '24h': '1d',
      '1day': '1d',
      '3d': '3d',
      '72h': '3d',
      '1w': '1week',
      '1week': '1week',
      '7d': '1week',
      '1m': '1m',
      '30d': '1m',
      '1month': '1m',
      '3m': '3m',
      '90d': '3m',
      '6m': '6m',
      '180d': '6m',
      '1y': '1y',
      '12m': '1y',
      '365d': '1y',
      'all': 'all',
      'max': 'all'
    }
    const apiRange = rangeMap[rawRange.toLowerCase()] || '1d'
    
    // Load portfolio data once for this request
    const portfolioData = await loadPortfolioFromDB(userId)

    // Calculate time window
    const now = Date.now()
    let startTime: number
    let endTime: number = now
    
    if (apiRange === '1h') {
      startTime = now - (60 * 60 * 1000)
    } else if (apiRange === '1d') {
      startTime = now - (24 * 60 * 60 * 1000)
    } else if (apiRange === '3d') {
      startTime = now - (3 * 24 * 60 * 60 * 1000)
    } else if (apiRange === '1week') {
      startTime = now - (7 * 24 * 60 * 60 * 1000)
    } else if (apiRange === '1m') {
      startTime = now - (30 * 24 * 60 * 60 * 1000)
    } else if (apiRange === '3m') {
      startTime = now - (90 * 24 * 60 * 60 * 1000)
    } else if (apiRange === '6m') {
      startTime = now - (180 * 24 * 60 * 60 * 1000)
    } else if (apiRange === '1y') {
      startTime = now - (365 * 24 * 60 * 60 * 1000)
    } else {
      // For 'all', get first trade timestamp
      if (portfolioData.transactions.length > 0) {
        const firstTrade = portfolioData.transactions.reduce((earliest, tx) => 
          tx.timestamp < earliest.timestamp ? tx : earliest
        )
        startTime = firstTrade.timestamp
      } else {
        startTime = now - (30 * 24 * 60 * 60 * 1000)
      }
    }
    
    // Get CURRENT holdings from DB (positions table)
    // These are the actual stocks we own RIGHT NOW with their shares and avg prices
    const currentHoldings = portfolioData.positions.filter(p => p.totalShares > 0)

    const walletTransactions = portfolioData.walletTransactions || []
    const tradeTransactions = portfolioData.transactions || []

    // Calculate cost basis and net deposits
    const holdingsCostBasis = currentHoldings.reduce((sum, h) => {
      return sum + (h.totalCost || (h.avgPrice * h.totalShares) || 0)
    }, 0)
    const netDeposits = walletTransactions.reduce((sum, t) => {
      return sum + (t.action === 'deposit' ? (t.amount || 0) : -(t.amount || 0))
    }, 0)
    const normalizedNetDeposits = Math.max(0, netDeposits)
    const inferredDeposits = normalizedNetDeposits > 0
      ? normalizedNetDeposits
      : (portfolioData.walletBalance > 0 ? portfolioData.walletBalance : 0)
    const costBasis = inferredDeposits > 0 ? inferredDeposits : holdingsCostBasis

    // Get symbols from current holdings
    const symbols = currentHoldings.map(h => h.symbol.toUpperCase())
    
    // Get time sections for the chart (x-axis points)
    const sections = getSectionsForRange(apiRange, startTime, endTime)
    const sectionTimestamps = sections
      .map((ts: any) => Number(ts))
      .filter((ts: number) => Number.isFinite(ts))
      .sort((a: number, b: number) => a - b)
    
    // Build cash timeline events from wallet transactions + trades
    const cashEvents: Array<{ timestamp: number; delta: number }> = []
    for (const tx of walletTransactions) {
      const delta = tx.action === 'deposit' ? (tx.amount || 0) : -(tx.amount || 0)
      cashEvents.push({ timestamp: tx.timestamp || 0, delta })
    }
    for (const tx of tradeTransactions) {
      if (!tx?.timestamp) continue
      const tradeDelta = (tx.action === 'buy' ? -1 : 1) * (tx.price || 0) * (tx.quantity || 0)
      if (tradeDelta !== 0) {
        cashEvents.push({ timestamp: tx.timestamp, delta: tradeDelta })
      }
    }

    cashEvents.sort((a, b) => a.timestamp - b.timestamp)
    const totalCashDelta = cashEvents.reduce((sum, e) => sum + e.delta, 0)
    const baseCashBalance = (portfolioData.walletBalance || 0) - totalCashDelta

    // Fetch historical prices for all symbols
    // Map: symbol -> array of {t: timestamp, c: close_price}
    const historicalPricesMap = new Map<string, Array<{t: number, c: number}>>()
    
    // Determine chart range for price fetching based on requested range
    let chartRange = '1m'
    if (apiRange === '1h' || apiRange === '1d' || apiRange === '3d') {
      chartRange = '1d' // 1d candles have minute-level data for 1H/1D views
    } else if (apiRange === '1week') {
      chartRange = '1m'
    } else if (apiRange === '1m') {
      chartRange = '3m'
    } else if (apiRange === '3m') {
      chartRange = '6m'
    } else if (apiRange === '6m') {
      chartRange = '1y'
    } else {
      chartRange = '1y'
    }
    
    // Fetch historical prices for all symbols in parallel
    if (symbols.length > 0) {
      await Promise.all(symbols.map(async (symbol) => {
        try {
          const candlesResult = await getCandles(symbol, chartRange)
          if (candlesResult.data && candlesResult.data.length > 0) {
            const prices = candlesResult.data
              .filter((c: any) => {
                const t = c.t || c.timestamp || 0
                return t >= startTime && t <= endTime
              })
              .map((c: any) => ({
                t: c.t || c.timestamp || 0,
                c: c.c ?? c.close ?? c.price ?? 0
              }))
              .filter((p: any) => p.c > 0 && p.t > 0)
              .sort((a: any, b: any) => a.t - b.t)
            
            historicalPricesMap.set(symbol, prices)
          }
        } catch (error: any) {
          console.error(`[Timeseries Calculated] Failed to fetch prices for ${symbol}:`, error.message)
          historicalPricesMap.set(symbol, [])
        }
      }))
    }
    
    // Fetch current real-time prices for all symbols (for recent points)
    const currentPricesMap = new Map<string, number>()
    if (symbols.length > 0) {
      try {
        await Promise.all(symbols.map(async (symbol) => {
          try {
            const quote = await getQuoteWithFallback(symbol)
            if (quote && quote.price > 0) {
              currentPricesMap.set(symbol.toUpperCase(), quote.price)
            }
          } catch (error: any) {
            // If quote fails, we'll use historical prices
          }
        }))
      } catch (error: any) {
        console.error('[Timeseries Calculated] Failed to fetch current prices:', error.message)
      }
    }
    
    // Helper function to get price at a specific timestamp
    // Always uses historical prices for the timestamp - no interpolation or current price substitution
    // This ensures each point shows the actual price at that time, creating proper graph variation
    const getPriceAtTime = (symbol: string, timestamp: number, useCurrentPrice: boolean = false): number => {
      const symbolUpper = symbol.toUpperCase()
      
      // Only use current price if explicitly requested (for the last point)
      if (useCurrentPrice) {
        const currentPrice = currentPricesMap.get(symbolUpper)
        if (currentPrice && currentPrice > 0) {
          return currentPrice
        }
      }
      
      // Always use historical prices for historical timestamps
      // This ensures the graph shows actual price movements over time
      const prices = historicalPricesMap.get(symbolUpper) || []
      if (prices.length === 0) {
        // Fallback to current price only if no historical data available
        return currentPricesMap.get(symbolUpper) || 0
      }
      
      // Find the closest price at or before this timestamp
      let bestPrice = 0
      for (const price of prices) {
        if (price.t <= timestamp) {
          bestPrice = price.c
        } else {
          break
        }
      }
      
      // If no price found before timestamp, use first available price (backward fill)
      if (bestPrice === 0 && prices.length > 0) {
        bestPrice = prices[0].c
      }
      
      return bestPrice
    }
    
    // Build time series: for each timestamp, calculate portfolio value
    const series: Array<{
      t: number
      portfolio: number
      portfolioAbs: number
      costBasis: number
      costBasisAbs: number
      netInvested: number
      netInvestedAbs: number
      deltaFromStart$: number
      deltaFromStartPct: number
      overallReturn$: number
      overallReturnPct: number
    }> = []
    
    // Process each time section
    // For each timestamp (x-axis), calculate portfolio value (y-axis) using prices at that time
    let cashBalance = baseCashBalance
    let cashIndex = 0

    for (let i = 0; i < sectionTimestamps.length; i++) {
      const sectionTime = sectionTimestamps[i]
      const isLastPoint = i === sectionTimestamps.length - 1
      
      while (cashIndex < cashEvents.length && cashEvents[cashIndex].timestamp <= sectionTime) {
        cashBalance += cashEvents[cashIndex].delta
        cashIndex += 1
      }

      // Calculate portfolio value at this time point
      // Formula: portfolioValue = sum(shares_i * price_i_at_that_time) for all holdings
      let portfolioValue = 0
      
      for (const holding of currentHoldings) {
        if (holding.totalShares > 0) {
          const symbol = holding.symbol.toUpperCase()
          // For the last point, use current real-time price to show live updates
          // For all other points, use historical price at that specific time
          const price = getPriceAtTime(symbol, sectionTime, isLastPoint)
          if (price > 0) {
            portfolioValue += price * holding.totalShares
          }
        }
      }
      
      // Include cash balance (deposits/withdrawals/trades) in total portfolio value
      portfolioValue += cashBalance

      // If no price data available and no cash, skip this point (don't use cost basis as fallback for graph)
      if (portfolioValue === 0) {
        continue
      }
      
      // Calculate returns
      const totalReturn = portfolioValue - costBasis
      const totalReturnPct = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0
      
      // Calculate delta from start
      const firstPoint = series.length === 0 ? null : series[0]
      const deltaFromStart$ = firstPoint ? portfolioValue - firstPoint.portfolio : 0
      const deltaFromStartPct = firstPoint && firstPoint.portfolio > 0 
        ? (deltaFromStart$ / firstPoint.portfolio) * 100 
        : 0
      
      series.push({
        t: sectionTime, // X-axis: timestamp
        portfolio: portfolioValue, // Y-axis: portfolio value at this time
        portfolioAbs: portfolioValue,
        costBasis: costBasis, // Constant: sum(shares * avgPrice)
        costBasisAbs: costBasis,
        netInvested: costBasis,
        netInvestedAbs: costBasis,
        deltaFromStart$,
        deltaFromStartPct,
        overallReturn$: totalReturn,
        overallReturnPct: totalReturnPct
      })
    }
    
    // Ensure series is sorted by timestamp
    series.sort((a, b) => a.t - b.t)
    
    // Get current portfolio totals from dashboard API (matches summary exactly)
    let finalPortfolioValue = series.length > 0 ? series[series.length - 1].portfolio : 0
    let dashboardTotals: {
      tpv: number
      costBasis: number
      totalReturn: number
      totalReturnPct: number
    } | null = null
    let dashboardWalletBalance = portfolioData.walletBalance || 0
    
    try {
      const protocol = req.headers.get('x-forwarded-proto') || 'http'
      const host = req.headers.get('host') || 'localhost:3000'
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
      
      const portfolioRes = await fetch(`${baseUrl}/api/portfolio?enrich=1`, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (portfolioRes.ok) {
        const portfolioResponse = await portfolioRes.json()
        dashboardTotals = portfolioResponse.totals || null
        dashboardWalletBalance = portfolioResponse?.wallet?.balance ?? dashboardWalletBalance
        
        // Update the last point with current portfolio value (holdings + cash)
        if (series.length > 0) {
          const lastPoint = series[series.length - 1]
          const dashboardTpv = (dashboardTotals?.tpv || 0) + (dashboardWalletBalance || 0)
          const dashboardCostBasis = costBasis > 0 ? costBasis : (dashboardTotals?.costBasis || 0)
          const dashboardReturn = dashboardTpv - dashboardCostBasis
          const dashboardReturnPct = dashboardCostBasis > 0 ? (dashboardReturn / dashboardCostBasis) * 100 : 0
          
          lastPoint.portfolio = dashboardTpv
          lastPoint.portfolioAbs = dashboardTpv
          lastPoint.overallReturn$ = dashboardReturn
          lastPoint.overallReturnPct = dashboardReturnPct
          lastPoint.t = endTime // Current time
          finalPortfolioValue = dashboardTpv
        }
      }
    } catch (error: any) {
      console.error('[Timeseries Calculated] Failed to fetch dashboard totals:', error.message)
    }
    
    // Ensure we have at least 2 points for the graph to render
    if (series.length === 1) {
      const onlyPoint = series[0]
      series.push({
        ...onlyPoint,
        t: onlyPoint.t + 60000 // Add 1 minute
      })
    }
    
    return NextResponse.json({
      range: rawRange,
      granularity: 'calculated',
      currency: 'USD',
      series,
      sections: sectionTimestamps,
      window: { startTime, endTime },
      totals: {
        tpv: finalPortfolioValue,
        costBasis: costBasis,
        totalReturn: finalPortfolioValue - costBasis,
        totalReturnPct: costBasis > 0 ? ((finalPortfolioValue - costBasis) / costBasis) * 100 : 0
      },
      meta: {
        symbols: Array.from(symbols),
        hasFx: false,
        lastQuoteTs: new Date().toISOString(),
        startIndex: 0,
        startPortfolioAbs: series.length > 0 ? series[0].portfolio : 0
      }
    })
  } catch (error: any) {
    console.error('[Timeseries Calculated] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to calculate timeseries' },
      { status: 500 }
    )
  }
}
