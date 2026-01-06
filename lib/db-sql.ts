/**
 * Direct Neon PostgreSQL database access layer
 * Uses pg (node-postgres) for direct SQL queries
 * No Prisma - simple, fast, reliable
 */

import { Pool } from 'pg'

// Global pool singleton (reused across requests)
const globalForPool = globalThis as unknown as {
  pool: Pool | undefined
}

function getPool(): Pool {
  if (globalForPool.pool) {
    return globalForPool.pool
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon') ? {
      rejectUnauthorized: false,
    } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err)
  })

  if (process.env.NODE_ENV !== 'production') {
    globalForPool.pool = pool
  }

  return pool
}

export const pool = getPool()

/**
 * Get or create portfolio for user (idempotent)
 */
export async function getOrCreatePortfolio(userId: string) {
  const client = await pool.connect()
  try {
    // Check if portfolio exists (use camelCase column names as per Prisma schema)
    const checkResult = await client.query(
      'SELECT id FROM portfolios WHERE "userId" = $1',
      [userId]
    )

    if (checkResult.rows.length > 0) {
      return checkResult.rows[0].id
    }

    // Create new portfolio (use camelCase column names)
    const insertResult = await client.query(
      'INSERT INTO portfolios (id, "userId", "walletBalance", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, 0, NOW(), NOW()) RETURNING id',
      [userId]
    )

    return insertResult.rows[0].id
  } finally {
    client.release()
  }
}

/**
 * Load portfolio data from database
 */
export async function loadPortfolioFromDB(userId: string) {
  const portfolioId = await getOrCreatePortfolio(userId)
  const client = await pool.connect()

  try {
    // Get portfolio with all related data (use camelCase column names)
    const [portfolioResult, positionsResult, tradesResult, walletTxResult] = await Promise.all([
      client.query('SELECT "walletBalance" FROM portfolios WHERE id = $1', [portfolioId]),
      client.query(
        'SELECT symbol, "totalShares", "avgPrice", "totalCost", "realizedPnl" FROM positions WHERE "portfolioId" = $1 AND "totalShares" > 0',
        [portfolioId]
      ),
      client.query(
        'SELECT id, symbol, action, price, quantity, timestamp, note FROM trades WHERE "portfolioId" = $1 ORDER BY timestamp DESC',
        [portfolioId]
      ),
      client.query(
        'SELECT id, action, amount, timestamp, method FROM wallet_transactions WHERE "portfolioId" = $1 ORDER BY timestamp DESC',
        [portfolioId]
      ),
    ])

    const walletBalance = portfolioResult.rows[0]?.walletBalance || 0

    const positions = positionsResult.rows.map((row: any) => ({
      symbol: row.symbol,
      totalShares: parseFloat(row.totalShares) || 0,
      avgPrice: parseFloat(row.avgPrice) || 0,
      totalCost: parseFloat(row.totalCost) || 0,
      realizedPnl: parseFloat(row.realizedPnl) || 0,
      marketValue: 0, // Will be enriched by API
    }))

    const transactions = tradesResult.rows.map((row: any) => ({
      id: row.id,
      symbol: row.symbol,
      action: row.action,
      price: parseFloat(row.price) || 0,
      quantity: parseFloat(row.quantity) || 0,
      timestamp: row.timestamp.getTime(),
      note: row.note || undefined,
    }))

    const walletTransactions = walletTxResult.rows.map((row: any) => ({
      id: row.id,
      action: row.action,
      amount: parseFloat(row.amount) || 0,
      timestamp: row.timestamp.getTime(),
      method: row.method || 'Manual',
      resultingBalance: undefined, // Calculated client-side if needed
    }))

    return {
      positions,
      transactions,
      walletBalance,
      walletTransactions,
    }
  } finally {
    client.release()
  }
}

/**
 * Save position to database
 */
export async function savePositionToDB(
  userId: string,
  position: { symbol: string; totalShares: number; avgPrice: number; totalCost: number; realizedPnl: number }
): Promise<void> {
  const portfolioId = await getOrCreatePortfolio(userId)
  const client = await pool.connect()

  try {
    if (position.totalShares <= 0) {
      // Delete position if shares are 0
      await client.query(
        'DELETE FROM positions WHERE "portfolioId" = $1 AND symbol = $2',
        [portfolioId, position.symbol]
      )
    } else {
      // Upsert position (use camelCase column names)
      await client.query(
        `INSERT INTO positions (id, "portfolioId", symbol, "totalShares", "avgPrice", "totalCost", "realizedPnl", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT ("portfolioId", symbol)
         DO UPDATE SET
           "totalShares" = EXCLUDED."totalShares",
           "avgPrice" = EXCLUDED."avgPrice",
           "totalCost" = EXCLUDED."totalCost",
           "realizedPnl" = EXCLUDED."realizedPnl",
           "updatedAt" = NOW()`,
        [
          portfolioId,
          position.symbol,
          position.totalShares,
          position.avgPrice,
          position.totalCost,
          position.realizedPnl,
        ]
      )
    }
  } finally {
    client.release()
  }
}

/**
 * Save trade to database
 */
export async function saveTradeToDB(
  userId: string,
  transaction: { symbol: string; action: string; price: number; quantity: number; timestamp: number; note?: string }
): Promise<void> {
  const portfolioId = await getOrCreatePortfolio(userId)
  const client = await pool.connect()

  try {
    await client.query(
      `INSERT INTO trades (id, "portfolioId", symbol, action, price, quantity, timestamp, note, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        portfolioId,
        transaction.symbol,
        transaction.action,
        transaction.price,
        transaction.quantity,
        new Date(transaction.timestamp),
        transaction.note || null,
      ]
    )
  } finally {
    client.release()
  }
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
  const portfolioId = await getOrCreatePortfolio(userId)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    try {
      // Insert wallet transaction (use camelCase column names, method is lowercase)
      await client.query(
        `INSERT INTO wallet_transactions (id, "portfolioId", action, amount, timestamp, method, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW())`,
        [
          portfolioId,
          walletTx.action,
          walletTx.amount,
          new Date(walletTx.timestamp),
          walletTx.method || 'Manual',
        ]
      )

      // Update portfolio wallet balance (use camelCase column names)
      await client.query(
        'UPDATE portfolios SET "walletBalance" = $1, "updatedAt" = NOW() WHERE id = $2',
        [walletTx.resultingBalance, portfolioId]
      )

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  } finally {
    client.release()
  }
}

/**
 * Update wallet balance in database
 */
export async function updateWalletBalanceInDB(
  userId: string,
  balance: number
): Promise<void> {
  const portfolioId = await getOrCreatePortfolio(userId)
  const client = await pool.connect()

  try {
    await client.query(
      'UPDATE portfolios SET "walletBalance" = $1, "updatedAt" = NOW() WHERE id = $2',
      [balance, portfolioId]
    )
  } finally {
    client.release()
  }
}

/**
 * Sync all positions to database (bulk update)
 */
export async function syncPositionsToDB(
  userId: string,
  positions: Array<{ symbol: string; totalShares: number; avgPrice: number; totalCost: number; realizedPnl: number }>
): Promise<void> {
  const portfolioId = await getOrCreatePortfolio(userId)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    try {
      // Delete all existing positions
      await client.query('DELETE FROM positions WHERE "portfolioId" = $1', [portfolioId])

      // Insert new positions (only non-zero shares, use camelCase column names)
      const validPositions = positions.filter(p => p.totalShares > 0)
      if (validPositions.length > 0) {
        for (const pos of validPositions) {
          await client.query(
            `INSERT INTO positions (id, "portfolioId", symbol, "totalShares", "avgPrice", "totalCost", "realizedPnl", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [
              portfolioId,
              pos.symbol,
              pos.totalShares,
              pos.avgPrice,
              pos.totalCost,
              pos.realizedPnl,
            ]
          )
        }
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  } finally {
    client.release()
  }
}
