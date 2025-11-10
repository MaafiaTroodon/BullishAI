/**
 * Fast mark-to-market with delta updates
 * Only recalculates holdings that changed
 */

import type { Position } from './portfolio'

export interface HoldingsMap {
  [symbol: string]: {
    shares: number
    avgPrice: number
    costBasis: number
  }
}

export interface PriceUpdate {
  symbol: string
  price: number
  timestamp: number
}

export interface FastMarkToMarketResult {
  tpv: number
  costBasis: number
  totalReturn: number
  totalReturnPct: number
  holdings: Array<{
    symbol: string
    shares: number
    avgPrice: number
    currentPrice: number | null
    marketValue: number
    unrealizedPnl: number
    unrealizedPnlPct: number
    costBasis: number
  }>
  walletBalance: number
  lastUpdated: number
  changedSymbols: string[] // Symbols that changed
}

// Memoized holdings map cache
const HOLDINGS_CACHE = new Map<string, HoldingsMap>()

/**
 * Create memoized holdings map
 * Works with both Position[] and enriched items with currentPrice
 */
export function createHoldingsMap(positions: Position[] | any[]): HoldingsMap {
  const cacheKey = JSON.stringify(positions.map((p: any) => ({ 
    s: p.symbol, 
    sh: p.totalShares || 0, 
    a: p.avgPrice || 0 
  })))
  
  if (HOLDINGS_CACHE.has(cacheKey)) {
    return HOLDINGS_CACHE.get(cacheKey)!
  }

  const map: HoldingsMap = {}
  for (const pos of positions) {
    const shares = pos.totalShares || 0
    const avgPrice = pos.avgPrice || 0
    if (shares > 0 && avgPrice > 0) {
      const symbol = (pos.symbol || '').toUpperCase()
      if (symbol) {
        map[symbol] = {
          shares,
          avgPrice,
          costBasis: shares * avgPrice
        }
      }
    }
  }

  HOLDINGS_CACHE.set(cacheKey, map)
  // Limit cache size
  if (HOLDINGS_CACHE.size > 100) {
    const firstKey = HOLDINGS_CACHE.keys().next().value
    HOLDINGS_CACHE.delete(firstKey)
  }

  return map
}

/**
 * Fast delta update: only recalculate holdings with changed prices
 */
export function calculateMarkToMarketDelta(
  holdingsMap: HoldingsMap,
  priceUpdates: PriceUpdate[],
  previousPrices: Map<string, number>,
  walletBalance: number = 0,
  includeWalletInTPV: boolean = false
): FastMarkToMarketResult {
  const now = Date.now()
  const changedSymbols: string[] = []
  const currentPrices = new Map(previousPrices)

  // Update prices for changed symbols
  for (const update of priceUpdates) {
    const symbol = update.symbol.toUpperCase()
    const oldPrice = currentPrices.get(symbol)
    if (oldPrice !== update.price) {
      currentPrices.set(symbol, update.price)
      changedSymbols.push(symbol)
    }
  }

  // Calculate holdings with current prices
  let totalCostBasis = 0
  let totalMarketValue = 0
  const holdings = Object.entries(holdingsMap).map(([symbol, holding]) => {
    const currentPrice = currentPrices.get(symbol) ?? null
    const marketValue = currentPrice ? holding.shares * currentPrice : holding.costBasis
    const unrealizedPnl = currentPrice ? marketValue - holding.costBasis : 0
    const unrealizedPnlPct = holding.costBasis > 0 ? (unrealizedPnl / holding.costBasis) * 100 : 0

    totalCostBasis += holding.costBasis
    totalMarketValue += marketValue

    return {
      symbol,
      shares: holding.shares,
      avgPrice: holding.avgPrice,
      currentPrice,
      marketValue,
      unrealizedPnl,
      unrealizedPnlPct,
      costBasis: holding.costBasis,
    }
  })

  // Calculate TPV
  const tpv = includeWalletInTPV 
    ? totalMarketValue + walletBalance
    : totalMarketValue

  // Calculate total return
  const totalReturn = tpv - totalCostBasis
  const totalReturnPct = totalCostBasis > 0 ? (totalReturn / totalCostBasis) * 100 : 0

  return {
    tpv,
    costBasis: totalCostBasis,
    totalReturn,
    totalReturnPct,
    holdings,
    walletBalance,
    lastUpdated: now,
    changedSymbols,
  }
}

/**
 * Throttle DB snapshot saves
 * Only save if:
 * - 30-60s elapsed since last save, OR
 * - TPV changed by >0.1%
 */
export class SnapshotThrottle {
  private lastSaveTime = 0
  private lastTPV = 0
  private readonly minInterval = 30000 // 30s minimum
  private readonly maxInterval = 60000 // 60s maximum
  private readonly deltaThreshold = 0.001 // 0.1%

  shouldSave(currentTPV: number): boolean {
    const now = Date.now()
    const timeSinceLastSave = now - this.lastSaveTime
    const tpvDelta = Math.abs((currentTPV - this.lastTPV) / (this.lastTPV || 1))

    // Save if:
    // 1. Never saved before, OR
    // 2. Time threshold exceeded, OR
    // 3. TPV changed significantly
    if (this.lastSaveTime === 0) {
      this.lastSaveTime = now
      this.lastTPV = currentTPV
      return true
    }

    if (timeSinceLastSave >= this.minInterval && (timeSinceLastSave >= this.maxInterval || tpvDelta >= this.deltaThreshold)) {
      this.lastSaveTime = now
      this.lastTPV = currentTPV
      return true
    }

    return false
  }

  reset() {
    this.lastSaveTime = 0
    this.lastTPV = 0
  }
}

