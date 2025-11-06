import { NextRequest, NextResponse } from 'next/server'
import { listTransactions } from '@/lib/portfolio'
import { listWalletTransactions } from '@/lib/portfolio'

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
  
  for (const ts of timestamps) {
    // Find closest price at or before this timestamp
    const priceAt = prices.find(p => p.t <= ts && p.c > 0)
    if (priceAt) {
      lastPrice = priceAt.c
    }
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
    
    // Get all transactions
    let transactions = listTransactions(userId)
    let walletTx = listWalletTransactions(userId)
    
    // If no transactions in memory, try to load from localStorage (for client-side persistence)
    if (transactions.length === 0 && typeof window === 'undefined') {
      // Server-side: transactions should be in memory store
      // But we can't access localStorage here, so rely on sync from client
    }
    
    // If no transactions at all, return empty series
    if (transactions.length === 0 && walletTx.length === 0) {
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
        const price = priceMap?.get(bucket) || holding.avgCost || 0
        holdingsValue += holding.shares * price
        costBasis += holding.costBasis
      }
      
      const portfolioValue = holdingsValue + currentCash
      
      series.push({
        t: bucket,
        portfolio: Number(portfolioValue.toFixed(2)),
        holdings: Number(holdingsValue.toFixed(2)),
        cash: Number(currentCash.toFixed(2)),
        costBasis: Number(costBasis.toFixed(2)),
        moneyInvested: Number(currentMoneyInvested.toFixed(2)) // Lifetime net deposits
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

