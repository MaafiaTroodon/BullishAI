/**
 * Mark-to-market portfolio valuation
 * Calculates real-time portfolio value using live prices
 */

import { getQuoteWithFallback } from '@/lib/providers/market-data'
import type { Position } from './portfolio'

export interface MarkToMarketResult {
  tpv: number // Total Portfolio Value
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
}

/**
 * Calculate mark-to-market portfolio value
 * Uses live prices from quote API
 */
export async function calculateMarkToMarket(
  positions: Position[],
  walletBalance: number = 0,
  includeWalletInTPV: boolean = false
): Promise<MarkToMarketResult> {
  const now = Date.now()
  
  // Fetch all quotes in parallel
  const quotePromises = positions.map(async (pos) => {
    try {
      const quote = await getQuoteWithFallback(pos.symbol)
      return {
        symbol: pos.symbol,
        price: quote.price,
        error: null,
      }
    } catch (error: any) {
      console.error(`Failed to fetch quote for ${pos.symbol}:`, error.message)
      return {
        symbol: pos.symbol,
        price: null,
        error: error.message,
      }
    }
  })

  const quotes = await Promise.all(quotePromises)
  const quoteMap = new Map(quotes.map(q => [q.symbol, q.price]))

  // Calculate holdings with live prices
  let totalCostBasis = 0
  let totalMarketValue = 0
  const holdings = positions.map((pos) => {
    const currentPrice = quoteMap.get(pos.symbol) ?? null
    const shares = pos.totalShares || 0
    const avgPrice = pos.avgPrice || 0
    const costBasis = shares * avgPrice
    const marketValue = currentPrice ? shares * currentPrice : costBasis // Fallback to cost if no price
    const unrealizedPnl = currentPrice ? marketValue - costBasis : 0
    const unrealizedPnlPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0

    totalCostBasis += costBasis
    totalMarketValue += marketValue

    return {
      symbol: pos.symbol,
      shares,
      avgPrice,
      currentPrice,
      marketValue,
      unrealizedPnl,
      unrealizedPnlPct,
      costBasis,
    }
  })

  // Calculate TPV (Total Portfolio Value)
  // R3B: Include wallet in TPV
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
  }
}

/**
 * Save portfolio snapshot to database
 */
export async function savePortfolioSnapshot(
  userId: string,
  snapshot: MarkToMarketResult
): Promise<void> {
  const { pool } = await import('./db-sql')
  const client = await pool.connect()

  try {
    await client.query(
      `INSERT INTO portfolio_snapshots ("userId", "timestamp", "tpv", "walletBalance", "costBasis", "totalReturn", "totalReturnPct", "details")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        new Date(snapshot.lastUpdated),
        snapshot.tpv,
        snapshot.walletBalance,
        snapshot.costBasis,
        snapshot.totalReturn,
        snapshot.totalReturnPct,
        JSON.stringify({
          holdings: snapshot.holdings,
        }),
      ]
    )
  } catch (error: any) {
    // If table doesn't exist, log and continue (will be created by migration)
    if (error.message?.includes('does not exist')) {
      console.warn('portfolio_snapshots table not found, skipping snapshot save')
    } else {
      console.error('Error saving portfolio snapshot:', error)
    }
  } finally {
    client.release()
  }
}

/**
 * Get portfolio time-series data for chart
 */
export async function getPortfolioTimeSeries(
  userId: string,
  range: string = '1d'
): Promise<Array<{ t: number; y: number }>> {
  const { pool } = await import('./db-sql')
  const client = await pool.connect()

  try {
    // Calculate time range
    const now = Date.now()
    const rangeMs: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
      '3M': 90 * 24 * 60 * 60 * 1000,
      '6M': 180 * 24 * 60 * 60 * 1000,
      '1Y': 365 * 24 * 60 * 60 * 1000,
      'ALL': Infinity,
    }

    const rangeBack = rangeMs[range] || 24 * 60 * 60 * 1000
    const startTime = range === 'ALL' ? 0 : now - rangeBack

    // Query snapshots
    let query = `SELECT "timestamp", "tpv" FROM portfolio_snapshots WHERE "userId" = $1`
    const params: any[] = [userId]

    if (range !== 'ALL') {
      query += ` AND "timestamp" >= $2`
      params.push(new Date(startTime))
    }

    query += ` ORDER BY "timestamp" ASC`

    const result = await client.query(query, params)

    // Convert to chart format
    return result.rows.map((row: any) => ({
      t: row.timestamp.getTime(),
      y: parseFloat(row.tpv) || 0,
    }))
  } catch (error: any) {
    // If table doesn't exist, return empty array
    if (error.message?.includes('does not exist')) {
      return []
    }
    console.error('Error fetching portfolio time series:', error)
    return []
  } finally {
    client.release()
  }
}

