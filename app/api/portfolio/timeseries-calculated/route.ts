import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth-server'
import { loadPortfolioFromDB } from '@/lib/db-sql'
import { getSectionsForRange } from '@/lib/portfolio-snapshots'
import { getCandles } from '@/lib/market-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/portfolio/timeseries-calculated
 * Calculates portfolio value over time based on trades and historical prices
 * 
 * This endpoint:
 * 1. Gets all trades from DB (with timestamps)
 * 2. For each time point in the range, calculates what positions existed at that time
 * 3. Fetches historical prices for each stock at that time point
 * 4. Calculates portfolio value = sum(historical_price * shares_owned_at_that_time)
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
    
    // Get all trades from DB FIRST to find earliest purchase
    const portfolioData = await loadPortfolioFromDB(userId)
    const trades = portfolioData.transactions.sort((a, b) => a.timestamp - b.timestamp) // Sort ascending
    
    if (trades.length === 0) {
      // No trades, return empty series
      const now = Date.now()
      const sections = getSectionsForRange(apiRange, now - (30 * 24 * 60 * 60 * 1000), now)
      return NextResponse.json({
        range: rawRange,
        series: [],
        sections: sections.map(ts => Number(ts)),
        window: { startTime: now - (30 * 24 * 60 * 60 * 1000), endTime: now },
        totals: {
          tpv: 0,
          costBasis: 0,
          totalReturn: 0,
          totalReturnPct: 0
        }
      })
    }
    
    // Find the earliest BUY trade - that's when portfolio started
    const buyTrades = trades.filter(t => t.action === 'buy')
    if (buyTrades.length === 0) {
      // No buy trades, return empty
      const now = Date.now()
      const sections = getSectionsForRange(apiRange, now - (30 * 24 * 60 * 60 * 1000), now)
      return NextResponse.json({
        range: rawRange,
        series: [],
        sections: sections.map(ts => Number(ts)),
        window: { startTime: now - (30 * 24 * 60 * 60 * 1000), endTime: now },
        totals: {
          tpv: 0,
          costBasis: 0,
          totalReturn: 0,
          totalReturnPct: 0
        }
      })
    }
    
    const earliestBuyTrade = buyTrades.reduce((earliest, tx) => 
      tx.timestamp < earliest.timestamp ? tx : earliest
    )
    const portfolioStartTime = earliestBuyTrade.timestamp
    
    // Calculate time window - start from when first stock was bought
    const now = Date.now()
    let requestedStartTime: number
    let endTime: number = now
    
    if (apiRange === '1h') {
      requestedStartTime = now - (60 * 60 * 1000)
    } else if (apiRange === '1d') {
      requestedStartTime = now - (24 * 60 * 60 * 1000)
    } else if (apiRange === '3d') {
      requestedStartTime = now - (3 * 24 * 60 * 60 * 1000)
    } else if (apiRange === '1week') {
      requestedStartTime = now - (7 * 24 * 60 * 60 * 1000)
    } else if (apiRange === '1m') {
      requestedStartTime = now - (30 * 24 * 60 * 60 * 1000)
    } else if (apiRange === '3m') {
      requestedStartTime = now - (90 * 24 * 60 * 60 * 1000)
    } else if (apiRange === '6m') {
      requestedStartTime = now - (180 * 24 * 60 * 60 * 1000)
    } else if (apiRange === '1y') {
      requestedStartTime = now - (365 * 24 * 60 * 60 * 1000)
    } else {
      // For 'all', use portfolio start time
      requestedStartTime = portfolioStartTime
    }
    
    // CRITICAL: Start time should be the later of: requested range start OR when portfolio actually started
    // This ensures we only show data from when stocks were actually bought
    const startTime = Math.max(requestedStartTime, portfolioStartTime)
    
    // Get time sections for the chart
    const sections = getSectionsForRange(apiRange, startTime, endTime)
    const sectionTimestamps = sections
      .map((ts: any) => Number(ts))
      .filter((ts: number) => Number.isFinite(ts))
      .sort((a: number, b: number) => a - b)
    
    // Get unique symbols from trades
    const symbols = Array.from(new Set(trades.map(t => t.symbol.toUpperCase())))
    
    // Fetch historical prices for all symbols
    // Map: symbol -> array of {t: timestamp, c: close_price}
    const historicalPricesMap = new Map<string, Array<{t: number, c: number}>>()
    
    // Determine chart range for price fetching (use a wider range to ensure coverage)
    let chartRange = '1m'
    if (apiRange === '1h' || apiRange === '1d' || apiRange === '3d') {
      chartRange = '1d'
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
    
    // Fetch prices for all symbols in parallel
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
    
    // Helper function to get price at a specific timestamp (forward fill)
    const getPriceAtTime = (symbol: string, timestamp: number): number => {
      const prices = historicalPricesMap.get(symbol) || []
      if (prices.length === 0) return 0
      
      // Find the closest price at or before this timestamp
      let bestPrice = 0
      for (const price of prices) {
        if (price.t <= timestamp) {
          bestPrice = price.c
        } else {
          break
        }
      }
      
      // If no price found before timestamp, use first available price
      if (bestPrice === 0 && prices.length > 0) {
        bestPrice = prices[0].c
      }
      
      return bestPrice
    }
    
    // Calculate positions at each time point
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
    
    // Track positions state as we iterate through time
    const positionsState = new Map<string, { shares: number, avgPrice: number, totalCost: number }>()
    let totalCostBasis = 0
    
    // Track which trades we've already applied
    let lastAppliedTradeIndex = -1
    
    // Process each time section
    for (const sectionTime of sectionTimestamps) {
      // Apply only new trades that happened since the last section time
      for (let i = lastAppliedTradeIndex + 1; i < trades.length; i++) {
        const trade = trades[i]
        if (trade.timestamp <= sectionTime) {
          const symbol = trade.symbol.toUpperCase()
          const current = positionsState.get(symbol) || { shares: 0, avgPrice: 0, totalCost: 0 }
          
          if (trade.action === 'buy') {
            const newShares = current.shares + trade.quantity
            const newTotalCost = current.totalCost + (trade.price * trade.quantity)
            const newAvgPrice = newShares > 0 ? newTotalCost / newShares : 0
            
            positionsState.set(symbol, {
              shares: newShares,
              avgPrice: newAvgPrice,
              totalCost: newTotalCost
            })
          } else if (trade.action === 'sell') {
            const newShares = Math.max(0, current.shares - trade.quantity)
            const soldCost = current.avgPrice * trade.quantity
            const newTotalCost = Math.max(0, current.totalCost - soldCost)
            
            if (newShares === 0) {
              positionsState.delete(symbol)
            } else {
              positionsState.set(symbol, {
                shares: newShares,
                avgPrice: current.avgPrice, // Keep same avg price
                totalCost: newTotalCost
              })
            }
          }
          
          lastAppliedTradeIndex = i
        } else {
          // Trades are sorted by timestamp, so we can break here
          break
        }
      }
      
      // Calculate portfolio value at this time point
      // Only include stocks that were bought by this time (positionsState already tracks this)
      let portfolioValue = 0
      let costBasis = 0
      
      for (const [symbol, position] of positionsState.entries()) {
        // Only calculate if we have shares (stock was bought by this time)
        if (position.shares > 0) {
          const price = getPriceAtTime(symbol, sectionTime)
          if (price > 0) {
            portfolioValue += price * position.shares
          }
          // Cost basis = total cost of all shares owned at this time
          costBasis += position.totalCost
        }
      }
      
      // Update total cost basis (use the latest calculated value)
      totalCostBasis = costBasis
      
      // Calculate returns using dashboard formula: Total Return = Portfolio Value - Cost Basis
      const totalReturn = portfolioValue - costBasis
      const totalReturnPct = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0
      
      // Calculate delta from start
      const firstPoint = series.length === 0 ? null : series[0]
      const deltaFromStart$ = firstPoint ? portfolioValue - firstPoint.portfolio : 0
      const deltaFromStartPct = firstPoint && firstPoint.portfolio > 0 
        ? (deltaFromStart$ / firstPoint.portfolio) * 100 
        : 0
      
      series.push({
        t: sectionTime,
        portfolio: portfolioValue,
        portfolioAbs: portfolioValue,
        costBasis: costBasis,
        costBasisAbs: costBasis,
        netInvested: costBasis,
        netInvestedAbs: costBasis,
        deltaFromStart$,
        deltaFromStartPct,
        overallReturn$: totalReturn,
        overallReturnPct: totalReturnPct
      })
    }
    
    // Update the last point with current dashboard portfolio value for real-time updates
    let finalPortfolioValue = series.length > 0 ? series[series.length - 1].portfolio : 0
    const finalCostBasis = totalCostBasis
    
    // Try to get current portfolio value from /api/portfolio endpoint
    try {
      const protocol = req.headers.get('x-forwarded-proto') || 'http'
      const host = req.headers.get('host') || 'localhost:3000'
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
      
      const portfolioRes = await fetch(`${baseUrl}/api/portfolio?enrich=1`, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (portfolioRes.ok) {
        const currentData = await portfolioRes.json()
        const currentTpv = currentData?.totals?.tpv || 0
        
        if (currentTpv > 0 && series.length > 0) {
          // Update last point with current dashboard value
          const lastPoint = series[series.length - 1]
          lastPoint.portfolio = currentTpv
          lastPoint.portfolioAbs = currentTpv
          lastPoint.overallReturn$ = currentTpv - finalCostBasis
          lastPoint.overallReturnPct = finalCostBasis > 0 ? ((currentTpv - finalCostBasis) / finalCostBasis) * 100 : 0
          lastPoint.t = endTime // Use current time
          finalPortfolioValue = currentTpv
        }
      }
    } catch (error: any) {
      // If fetch fails, use calculated value
      console.error('[Timeseries Calculated] Failed to fetch current portfolio:', error.message)
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
        costBasis: finalCostBasis,
        totalReturn: finalPortfolioValue - finalCostBasis,
        totalReturnPct: finalCostBasis > 0 ? ((finalPortfolioValue - finalCostBasis) / finalCostBasis) * 100 : 0
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

