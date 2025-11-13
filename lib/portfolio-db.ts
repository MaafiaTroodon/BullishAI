/**
 * Database persistence layer for portfolio data
 * DEPRECATED: Use lib/db-sql.ts instead (direct Neon SQL)
 * This file is kept for backward compatibility during migration
 */

import type { Position, Transaction } from './portfolio'
import { db } from './db'

/**
 * Check if Prisma client is properly initialized
 */
function isDbAvailable(): boolean {
  try {
    return !!(db && typeof db === 'object' && 'portfolio' in db && db.portfolio)
  } catch {
    return false
  }
}

/**
 * Get or create portfolio for user (idempotent)
 * Returns portfolio with all related data loaded
 */
export async function getOrCreatePortfolio(userId: string) {
  // Ensure db.portfolio is available (handle Prisma client initialization issues)
  if (!isDbAvailable()) {
    // In development, this might happen during hot reload
    // Return null to indicate DB is not available, caller should handle gracefully
    if (process.env.NODE_ENV === 'development') {
      console.warn('Prisma client not initialized. Database operations will be skipped.')
    }
    throw new Error('Database client not available')
  }
  
  let portfolio = await db.portfolio.findUnique({
    where: { userId },
    include: {
      positions: true,
      trades: {
        orderBy: { timestamp: 'desc' },
      },
      walletTransactions: {
        orderBy: { timestamp: 'desc' },
      },
    },
  })

  if (!portfolio) {
    // Create empty portfolio for new user
    portfolio = await db.portfolio.create({
      data: {
        userId,
        walletBalance: 0,
      },
      include: {
        positions: true,
        trades: true,
        walletTransactions: true,
      },
    })
  }

  return portfolio
}

/**
 * Load portfolio data from database
 */
export async function loadPortfolioFromDB(userId: string) {
  try {
    const portfolio = await getOrCreatePortfolio(userId)
  
  // Convert DB positions to Position format
  const positions: Position[] = portfolio.positions
    .filter(p => p.totalShares > 0)
    .map(p => ({
      symbol: p.symbol,
      totalShares: p.totalShares,
      avgPrice: p.avgPrice,
      totalCost: p.totalCost,
      realizedPnl: p.realizedPnl,
      marketValue: 0, // Will be enriched by API
    }))

  // Convert DB trades to Transaction format
  const transactions: Transaction[] = portfolio.trades.map(t => ({
    id: t.id,
    symbol: t.symbol,
    action: t.action as 'buy' | 'sell',
    price: t.price,
    quantity: t.quantity,
    timestamp: t.timestamp.getTime(),
    note: t.note || undefined,
  }))

    // Convert wallet transactions
    const walletTransactions = portfolio.walletTransactions.map(wt => ({
      id: wt.id,
      action: wt.action as 'deposit' | 'withdraw',
      amount: wt.amount,
      timestamp: wt.timestamp.getTime(),
      method: wt.method || 'Manual',
      resultingBalance: 0, // Will be calculated
    }))

    return {
      positions,
      transactions,
      walletBalance: portfolio.walletBalance,
      walletTransactions,
    }
  } catch (error: any) {
    // If DB is not available (e.g., during hot reload), return empty portfolio
    // The in-memory store will be used as fallback
    if (error?.message?.includes('Database client not available')) {
      return {
        positions: [],
        transactions: [],
        walletBalance: 0,
        walletTransactions: [],
      }
    }
    throw error
  }
}

/**
 * Save position to database
 */
export async function savePositionToDB(
  userId: string,
  position: Position
): Promise<void> {
  const portfolio = await getOrCreatePortfolio(userId)

  if (position.totalShares <= 0) {
    // Delete position if shares are 0
    await db.position.deleteMany({
      where: {
        portfolioId: portfolio.id,
        symbol: position.symbol,
      },
    })
  } else {
    // Upsert position
    await db.position.upsert({
      where: {
        portfolioId_symbol: {
          portfolioId: portfolio.id,
          symbol: position.symbol,
        },
      },
      create: {
        portfolioId: portfolio.id,
        symbol: position.symbol,
        totalShares: position.totalShares,
        avgPrice: position.avgPrice,
        totalCost: position.totalCost || position.avgPrice * position.totalShares,
        realizedPnl: position.realizedPnl || 0,
      },
      update: {
        totalShares: position.totalShares,
        avgPrice: position.avgPrice,
        totalCost: position.totalCost || position.avgPrice * position.totalShares,
        realizedPnl: position.realizedPnl || 0,
        updatedAt: new Date(),
      },
    })
  }
}

/**
 * Save trade to database
 */
export async function saveTradeToDB(
  userId: string,
  transaction: Transaction
): Promise<void> {
  const portfolio = await getOrCreatePortfolio(userId)

  await db.trade.create({
    data: {
      portfolioId: portfolio.id,
      symbol: transaction.symbol,
      action: transaction.action,
      price: transaction.price,
      quantity: transaction.quantity,
      timestamp: new Date(transaction.timestamp),
      note: transaction.note,
    },
  })
}

/**
 * Save wallet transaction to database
 */
export async function saveWalletTransactionToDB(
  userId: string,
  walletTx: {
    action: 'deposit' | 'withdraw'
    amount: number
    timestamp: number
    method?: string
    resultingBalance: number
  }
): Promise<void> {
  const portfolio = await getOrCreatePortfolio(userId)

  await db.walletTransaction.create({
    data: {
      portfolioId: portfolio.id,
      action: walletTx.action,
      amount: walletTx.amount,
      timestamp: new Date(walletTx.timestamp),
      method: walletTx.method || 'Manual',
    },
  })

  // Update portfolio wallet balance
  await db.portfolio.update({
    where: { id: portfolio.id },
    data: { walletBalance: walletTx.resultingBalance },
  })
}

/**
 * Update wallet balance in database
 */
export async function updateWalletBalanceInDB(
  userId: string,
  balance: number
): Promise<void> {
  const portfolio = await getOrCreatePortfolio(userId)
  
  await db.portfolio.update({
    where: { id: portfolio.id },
    data: { walletBalance: balance },
  })
}

/**
 * Sync all positions to database (bulk update)
 */
export async function syncPositionsToDB(
  userId: string,
  positions: Position[]
): Promise<void> {
  const portfolio = await getOrCreatePortfolio(userId)

  // Delete all existing positions
  await db.position.deleteMany({
    where: { portfolioId: portfolio.id },
  })

  // Create new positions (only non-zero shares)
  const validPositions = positions.filter(p => p.totalShares > 0)
  if (validPositions.length > 0) {
    await db.position.createMany({
      data: validPositions.map(p => ({
        portfolioId: portfolio.id,
        symbol: p.symbol,
        totalShares: p.totalShares,
        avgPrice: p.avgPrice,
        totalCost: p.totalCost || p.avgPrice * p.totalShares,
        realizedPnl: p.realizedPnl || 0,
      })),
    })
  }
}

