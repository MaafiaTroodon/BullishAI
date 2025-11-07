import { NextRequest, NextResponse } from 'next/server'
import { listTransactions, listPositions } from '@/lib/portfolio'

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
    
    // Determine time range FIRST
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
    
    // Get ALL trade transactions first
    const allTransactions = listTransactions(userId).filter(t => t.action === 'buy' || t.action === 'sell')
    
    // Filter transactions by selected range (CRITICAL: only process trades in visible range)
    let transactions = allTransactions
    if (range === 'ALL') {
      // For ALL, use all transactions but find earliest timestamp
      const fillTimestamps = allTransactions.map(t => t.timestamp).filter(t => t > 0)
      if (fillTimestamps.length > 0) {
        startTime = Math.min(...fillTimestamps)
      }
    } else {
      // Filter transactions to only those within the selected range
      transactions = allTransactions.filter(t => {
        const txTime = t.timestamp || 0
        return txTime >= startTime && txTime <= now
      })
    }
    
    // If no fills in this range, return empty series (wallet deposits don't create portfolio activity)
    if (transactions.length === 0) {
      return NextResponse.json({
        range,
        granularity: gran,
        currency: 'USD',
        series: [],
        meta: {
          symbols: [],
          hasFx: false,
          lastQuoteTs: new Date().toISOString(),
          startIndex: 0,
          startPortfolioAbs: 0
        }
      })
    }
    
    // Determine granularity based on range for optimal data density
    const granMs: Record<string, number> = {
      '1m': 60 * 1000,           // 1 minute for 1H range
      '5m': 5 * 60 * 1000,       // 5 minutes for 1D/3D ranges
      '1h': 60 * 60 * 1000,      // 1 hour for 1W range
      '1d': 24 * 60 * 60 * 1000  // 1 day for 1M+ ranges
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
    
    // Fetch current positions and quotes for latest point accuracy
    const currentPositions = listPositions(userId)
    const currentQuotes: Record<string, number> = {}
    const currentPositionMap: Record<string, { shares: number; avgCost: number }> = {}
    
    // Build current position map from actual positions
    currentPositions.forEach((pos: any) => {
      const sym = pos.symbol.toUpperCase()
      currentPositionMap[sym] = {
        shares: pos.totalShares || 0,
        avgCost: pos.avgPrice || 0
      }
    })
    
    // Fetch current quotes for all symbols in current positions
    const currentSymbols = currentPositions.map((p: any) => p.symbol.toUpperCase())
    if (currentSymbols.length > 0) {
      try {
        const quoteRes = await fetch(`${baseUrl}/api/quotes?symbols=${currentSymbols.join(',')}`, { cache: 'no-store' })
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
    
    // Process ONLY trade transactions (fills) within the selected range
    // Transactions are already filtered by range above
    const tradeEvents = transactions
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    
    // Build portfolio value over time
    const holdings: Record<string, { shares: number; avgCost: number; costBasis: number }> = {}
    
    // net_invested = cumulative cash invested in stocks (from fills only, NOT wallet deposits)
    let netInvested = 0 // Cumulative: + for BUY fills, - for SELL fills
    
    const series: Array<{
      t: number
      portfolio: number
      holdings: number
      costBasis: number
      netInvested: number
    }> = []
    
    let eventIndex = 0
    
    for (const bucket of buckets) {
      // Process all trade events (fills) up to this bucket
      while (eventIndex < tradeEvents.length && (tradeEvents[eventIndex].timestamp || 0) <= bucket) {
        const event = tradeEvents[eventIndex]
        const sym = event.symbol.toUpperCase()
        
        if (!holdings[sym]) {
          holdings[sym] = { shares: 0, avgCost: 0, costBasis: 0 }
        }
        
        if (event.action === 'buy') {
          const qty = event.quantity || 0
          const price = event.price || 0
          const fees = 0 // Fees not currently tracked, but can be added
          const totalCost = qty * price + fees
          
          // Update position
          const oldShares = holdings[sym].shares
          const oldAvg = holdings[sym].avgCost
          const newShares = oldShares + qty
          const newAvg = newShares > 0 ? ((oldShares * oldAvg) + totalCost) / newShares : price
          holdings[sym] = {
            shares: newShares,
            avgCost: newAvg,
            costBasis: newShares * newAvg
          }
          
          // Increase net_invested (cash that left wallet to buy stocks)
          netInvested += totalCost
        } else if (event.action === 'sell') {
          const qty = Math.min(event.quantity || 0, holdings[sym].shares)
          const price = event.price || 0
          const fees = 0 // Fees not currently tracked
          const proceeds = qty * price - fees
          
          // Update position
          holdings[sym].shares -= qty
          holdings[sym].costBasis = holdings[sym].shares * holdings[sym].avgCost
          
          // Decrease net_invested (cash returned to wallet from sell)
          netInvested -= proceeds
          
          if (holdings[sym].shares <= 0) {
            delete holdings[sym]
          }
        }
        
        eventIndex++
      }
      
      // Calculate portfolio value at this bucket
      let holdingsValue = 0
      let costBasis = 0
      
      // For the latest bucket (now), use current positions instead of historical holdings
      const positionsToUse = (bucket === now || Math.abs(bucket - now) < interval) 
        ? currentPositionMap 
        : holdings
      
      for (const [sym, holding] of Object.entries(positionsToUse)) {
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
        
        const shares = holding.shares || 0
        holdingsValue += shares * price
        
        // Cost basis: for current positions, use avgCost * shares; for historical, use costBasis
        if (bucket === now || Math.abs(bucket - now) < interval) {
          costBasis += holding.avgCost * shares
        } else {
          costBasis += (holding as any).costBasis || (holding.avgCost * shares)
        }
      }
      
      // Portfolio Value = mark-to-market positions only
      const portfolioValue = holdingsValue
      
      series.push({
        t: bucket,
        portfolio: Number(portfolioValue.toFixed(2)),
        holdings: Number(holdingsValue.toFixed(2)),
        costBasis: Number(costBasis.toFixed(2)),
        netInvested: Number(netInvested.toFixed(2)) // Cumulative cash invested from fills only (NOT wallet deposits)
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
        netInvestedAbs: point.netInvested, // Cumulative cash invested from fills only (NOT wallet deposits)
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

