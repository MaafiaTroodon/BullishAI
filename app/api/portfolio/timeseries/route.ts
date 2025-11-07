import { NextRequest, NextResponse } from 'next/server'
import { listTransactions, listWalletTransactions, listPositions } from '@/lib/portfolio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUserId() { return 'demo-user' }

// Helper to get historical prices for a symbol
async function getHistoricalPrices(symbol: string, range: string, startTime: number, endTime: number, baseUrl: string): Promise<Array<{t: number, c: number}>> {
  try {
    const res = await fetch(`${baseUrl}/api/chart?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    if (!data?.data || !Array.isArray(data.data)) return []
    
    // Filter to time range and normalize format
    return data.data
      .filter((p: any) => {
        const t = p.t || p.timestamp
        return typeof t === 'number' && t >= startTime && t <= endTime
      })
      .map((p: any) => ({
        t: p.t || p.timestamp,
        c: p.c ?? p.close ?? p.price ?? 0
      }))
      .filter((p: any) => p.c > 0)
      .sort((a: any, b: any) => a.t - b.t)
  } catch {
    return []
  }
}

// Forward fill prices for missing timestamps
function forwardFillPrices(prices: Array<{t: number, c: number}>, timestamps: number[]): Map<number, number> {
  const priceMap = new Map<number, number>()
  let lastPrice = 0
  
  // Sort prices by timestamp
  const sortedPrices = [...prices].sort((a, b) => a.t - b.t)
  
  for (const ts of timestamps) {
    // Find closest price at or before this timestamp
    let priceAt: {t: number, c: number} | undefined
    
    // Binary search for efficiency (or linear search for small arrays)
    for (let i = sortedPrices.length - 1; i >= 0; i--) {
      if (sortedPrices[i].t <= ts && sortedPrices[i].c > 0) {
        priceAt = sortedPrices[i]
        break
      }
    }
    
    if (priceAt) {
      lastPrice = priceAt.c
    }
    
    // Only set price if we have a valid lastPrice
    if (lastPrice > 0) {
      priceMap.set(ts, lastPrice)
    }
  }
  
  return priceMap
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId()
    const url = new URL(req.url)
    const range = url.searchParams.get('range') || '1M'
    const gran = url.searchParams.get('gran') || '1d'
    
    // Determine base URL
    const protocol = req.headers.get('x-forwarded-proto') || 'http'
    const host = req.headers.get('host') || 'localhost:3000'
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
    
    // Get all transactions and current positions
    let transactions = listTransactions(userId)
    let walletTx = listWalletTransactions(userId)
    const positions = listPositions(userId)
    
    // If no transactions but we have positions, generate chart data from current holdings
    // This ensures the graph displays even if transactions aren't synced yet
    if (transactions.length === 0 && walletTx.length === 0 && positions.length > 0) {
      // Generate a simple chart from current holdings
      const now = Date.now()
      const rangeMs: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '3d': 3 * 24 * 60 * 60 * 1000,
        '1week': 7 * 24 * 60 * 60 * 1000,
        '1M': 30 * 24 * 60 * 60 * 1000,
        '3M': 90 * 24 * 60 * 60 * 1000,
        '6M': 180 * 24 * 60 * 60 * 1000,
        '1Y': 365 * 24 * 60 * 60 * 1000,
        'ALL': 365 * 24 * 60 * 60 * 1000 // Limit ALL to 1 year for performance
      }
      
      const rangeBack = rangeMs[range] || 30 * 24 * 60 * 60 * 1000
      const startTime = now - rangeBack
      
      // Get symbols from positions
      const symbols = positions.map(p => p.symbol.toUpperCase())
      
      // Fetch historical prices for all positions
      const symbolPrices: Record<string, Array<{t: number, c: number}>> = {}
      await Promise.all(symbols.map(async (sym) => {
        symbolPrices[sym] = await getHistoricalPrices(sym, range, startTime, now, baseUrl)
      }))
      
      // Fetch current quotes for latest point accuracy
      const currentQuotes: Record<string, number> = {}
      await Promise.all(symbols.map(async (sym) => {
        try {
          const res = await fetch(`${baseUrl}/api/quote?symbol=${encodeURIComponent(sym)}`, { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json()
            const price = data?.data?.price ?? data?.price ?? null
            if (price) currentQuotes[sym] = price
          }
        } catch {}
      }))
      
      // Calculate current cost basis (sum of avgPrice * shares for all positions)
      let currentCostBasis = 0
      positions.forEach((p: any) => {
        currentCostBasis += (p.totalCost || p.avgPrice * p.totalShares) || 0
      })
      
      // Generate buckets
      const interval = gran === '5m' ? 5 * 60 * 1000 : gran === '1m' ? 60 * 1000 : 24 * 60 * 60 * 1000
      const buckets: number[] = []
      for (let t = startTime; t <= now; t += interval) {
        buckets.push(t)
      }
      if (buckets[buckets.length - 1] !== now) {
        buckets.push(now)
      }
      
      // Forward fill prices for each symbol
      const symbolPriceMaps: Record<string, Map<number, number>> = {}
      for (const sym of symbols) {
        symbolPriceMaps[sym] = forwardFillPrices(symbolPrices[sym] || [], buckets)
      }
      
      // Generate series with historical prices
      const series = buckets.map((bucket) => {
        let portfolioValue = 0
        
        // Calculate portfolio value at this bucket using historical prices
        positions.forEach((p: any) => {
          const sym = p.symbol.toUpperCase()
          const priceMap = symbolPriceMaps[sym]
          let price = 0
          
          // For the most recent bucket (now), use current quote if available
          if (bucket === now || Math.abs(bucket - now) < interval) {
            price = currentQuotes[sym] || priceMap?.get(bucket) || p.avgPrice || 0
          } else {
            // For older buckets, use historical price
            price = priceMap?.get(bucket) || p.avgPrice || 0
          }
          
          portfolioValue += price * p.totalShares
        })
        
        return {
          t: bucket,
          portfolio: portfolioValue,
          holdings: portfolioValue,
          cash: 0,
          costBasis: currentCostBasis,
          moneyInvested: currentCostBasis // Use cost basis as money invested
        }
      })
      
      // Calculate deltas from start
      const startPortfolioValue = series.length > 0 ? series[0].portfolio : 0
      const seriesWithDeltas = series.map((p: any) => {
        const deltaFromStart$ = startPortfolioValue > 0 ? p.portfolio - startPortfolioValue : 0
        const deltaFromStartPct = startPortfolioValue > 0 ? (deltaFromStart$ / startPortfolioValue) * 100 : 0
        
        return {
          t: p.t,
          portfolioAbs: p.portfolio,
          holdingsAbs: p.holdings,
          cashAbs: p.cash,
          netDepositsAbs: p.moneyInvested,
          deltaFromStart$: Number(deltaFromStart$.toFixed(2)),
          deltaFromStartPct: Number(deltaFromStartPct.toFixed(4))
        }
      })
      
      return NextResponse.json({
        range,
        granularity: gran,
        currency: 'USD',
        series: seriesWithDeltas,
        meta: {
          symbols,
          hasFx: false,
          lastQuoteTs: new Date().toISOString(),
          startIndex: 0,
          startPortfolioAbs: startPortfolioValue
        }
      })
    }
    
    // If no transactions and no positions, return empty series
    if (transactions.length === 0 && walletTx.length === 0 && positions.length === 0) {
      return NextResponse.json({
        range,
        granularity: gran,
        currency: 'USD',
        series: [],
        meta: {
          symbols: [],
          hasFx: false,
          lastQuoteTs: new Date().toISOString()
        }
      })
    }
    
    // Determine time range
    const now = Date.now()
    const rangeMs: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '1week': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
      '3M': 90 * 24 * 60 * 60 * 1000,
      '6M': 180 * 24 * 60 * 60 * 1000,
      '1Y': 365 * 24 * 60 * 60 * 1000,
      'ALL': Infinity
    }
    
    const rangeBack = rangeMs[range] || 30 * 24 * 60 * 60 * 1000
    let startTime = now - rangeBack
    if (range === 'ALL') {
      const allTimestamps = [
        ...transactions.map(t => t.timestamp),
        ...walletTx.map(w => w.timestamp || 0)
      ].filter(t => t > 0)
      if (allTimestamps.length > 0) {
        startTime = Math.min(...allTimestamps)
      }
    }
    
    // Determine granularity
    const granMs: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    }
    const interval = granMs[gran] || 24 * 60 * 60 * 1000
    
    // Create time buckets
    const buckets: number[] = []
    for (let t = startTime; t <= now; t += interval) {
      buckets.push(t)
    }
    buckets.push(now) // Always include "now"
    
    // Get all unique symbols from transactions
    const symbols = [...new Set(transactions.map(t => t.symbol.toUpperCase()))]
    
    // Fetch historical prices for all symbols
    const symbolPrices: Record<string, Array<{t: number, c: number}>> = {}
    await Promise.all(symbols.map(async (sym) => {
      symbolPrices[sym] = await getHistoricalPrices(sym, range, startTime, now, baseUrl)
    }))
    
    // Fetch current quotes for latest point accuracy
    const currentQuotes: Record<string, number> = {}
    if (symbols.length > 0) {
      try {
        const quoteRes = await fetch(`${baseUrl}/api/quotes?symbols=${symbols.join(',')}`, { cache: 'no-store' })
        if (quoteRes.ok) {
          const quoteData = await quoteRes.json()
          if (quoteData.quotes && Array.isArray(quoteData.quotes)) {
            quoteData.quotes.forEach((q: any) => {
              if (q.symbol && q.price) {
                currentQuotes[q.symbol.toUpperCase()] = q.price
              }
            })
          }
        }
      } catch (err) {
        console.error('Error fetching current quotes:', err)
      }
    }
    
    // Forward fill prices for each symbol
    const symbolPriceMaps: Record<string, Map<number, number>> = {}
    for (const sym of symbols) {
      symbolPriceMaps[sym] = forwardFillPrices(symbolPrices[sym] || [], buckets)
    }
    
    // Process transactions chronologically to build position snapshots
    const allEvents = [
      ...transactions.map(t => ({ ...t, type: 'trade' as const })),
      ...walletTx.map(w => ({ ...w, type: 'wallet' as const }))
    ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    
    // Build portfolio value over time
    const holdings: Record<string, { shares: number; avgCost: number; costBasis: number }> = {}
    let cashBalance = 0
    let moneyInvested = 0 // Net deposits (DEPOSIT - WITHDRAW), lifetime cumulative
    
    // Track last known values for forward-fill
    let lastCashBalance = 0
    let lastMoneyInvested = 0
    
    const series: Array<{
      t: number
      portfolio: number
      holdings: number
      cash: number
      costBasis: number
      moneyInvested: number
    }> = []
    
    let eventIndex = 0
    
    for (const bucket of buckets) {
      // Process all events up to this bucket
      while (eventIndex < allEvents.length && (allEvents[eventIndex].timestamp || 0) <= bucket) {
        const event = allEvents[eventIndex]
        
        if (event.type === 'wallet') {
          if (event.action === 'deposit') {
            cashBalance += event.amount || 0
            moneyInvested += event.amount || 0 // Track net deposits (lifetime)
          } else if (event.action === 'withdraw') {
            cashBalance -= event.amount || 0
            moneyInvested -= event.amount || 0 // Subtract withdrawals from net deposits (lifetime)
          }
          lastCashBalance = cashBalance
          lastMoneyInvested = moneyInvested
        } else if (event.type === 'trade') {
          const sym = event.symbol.toUpperCase()
          if (!holdings[sym]) {
            holdings[sym] = { shares: 0, avgCost: 0, costBasis: 0 }
          }
          
          if (event.action === 'buy') {
            const qty = event.quantity || 0
            const price = event.price || 0
            const oldShares = holdings[sym].shares
            const oldAvg = holdings[sym].avgCost
            const newShares = oldShares + qty
            const newAvg = newShares > 0 ? ((oldShares * oldAvg) + (qty * price)) / newShares : price
            holdings[sym] = {
              shares: newShares,
              avgCost: newAvg,
              costBasis: newShares * newAvg
            }
            cashBalance -= qty * price
            lastCashBalance = cashBalance
          } else if (event.action === 'sell') {
            const qty = Math.min(event.quantity || 0, holdings[sym].shares)
            holdings[sym].shares -= qty
            holdings[sym].costBasis = holdings[sym].shares * holdings[sym].avgCost
            cashBalance += qty * (event.price || 0)
            lastCashBalance = cashBalance
            if (holdings[sym].shares <= 0) {
              delete holdings[sym]
            }
          }
        }
        
        eventIndex++
      }
      
      // Forward-fill cash and moneyInvested if no events in this bucket
      // (This ensures continuity even if no transactions occurred)
      const currentCash = cashBalance || lastCashBalance
      const currentMoneyInvested = moneyInvested !== 0 ? moneyInvested : lastMoneyInvested
      
      // Calculate portfolio value at this bucket
      let holdingsValue = 0
      let costBasis = 0
      
      for (const [sym, holding] of Object.entries(holdings)) {
        const priceMap = symbolPriceMaps[sym]
        let price = 0
        
        // For the most recent bucket (now), use current quote if available
        if (bucket === now || Math.abs(bucket - now) < interval) {
          price = currentQuotes[sym] || priceMap?.get(bucket) || 0
        } else {
          // For older buckets, use historical price
          price = priceMap?.get(bucket) || 0
        }
        
        // Only use avgCost as absolute last resort (should rarely happen)
        if (price === 0 && holding.avgCost > 0) {
          price = holding.avgCost
        }
        
        holdingsValue += holding.shares * price
        costBasis += holding.costBasis
      }
      
      // Portfolio Value = mark-to-market positions only (exclude idle wallet cash)
      // Deposits should NOT affect Portfolio Value - only Net Deposits line
      const portfolioValue = holdingsValue
      
      series.push({
        t: bucket,
        portfolio: Number(portfolioValue.toFixed(2)), // Portfolio Value = positions only (no cash)
        holdings: Number(holdingsValue.toFixed(2)),
        cash: Number(currentCash.toFixed(2)),
        costBasis: Number(costBasis.toFixed(2)),
        moneyInvested: Number(currentMoneyInvested.toFixed(2)) // Lifetime net deposits (DEPOSIT - WITHDRAW) up to t
      })
    }
    
    // Find first non-null portfolio value for range start (with backward lookup)
    let startIndex = series.findIndex(s => s.portfolio > 0)
    let startPortfolioAbs = 0
    
    if (startIndex < 0) {
      // No valid portfolio in range - try to find most recent valid snapshot before range
      // For now, use first point if available
      if (series.length > 0) {
        startIndex = 0
        startPortfolioAbs = series[0].portfolio || 0
      }
    } else {
      startPortfolioAbs = series[startIndex].portfolio
    }
    
    // Calculate deltas for each point (from start of range)
    const seriesWithDeltas = series.map((point, idx) => {
      const deltaFromStart$ = startPortfolioAbs > 0 ? point.portfolio - startPortfolioAbs : 0
      const deltaFromStartPct = startPortfolioAbs > 0 ? (deltaFromStart$ / startPortfolioAbs) * 100 : 0
      
      return {
        t: point.t,
        portfolioAbs: point.portfolio, // Absolute portfolio value
        holdingsAbs: point.holdings,
        cashAbs: point.cash,
        netDepositsAbs: point.moneyInvested, // Lifetime net deposits (DEPOSIT - WITHDRAW) up to t
        deltaFromStart$: Number(deltaFromStart$.toFixed(2)),
        deltaFromStartPct: Number(deltaFromStartPct.toFixed(4))
      }
    })
    
    return NextResponse.json({
      range,
      granularity: gran,
      currency: 'USD',
      series: seriesWithDeltas,
      meta: {
        symbols,
        hasFx: false,
        lastQuoteTs: new Date().toISOString(),
        startIndex: startIndex >= 0 ? startIndex : 0,
        startPortfolioAbs
      }
    })
  } catch (error: any) {
    console.error('Timeseries error:', error)
    return NextResponse.json({ error: error.message || 'timeseries_error' }, { status: 500 })
  }
}

