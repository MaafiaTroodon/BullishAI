/**
 * Dividend Processing Logic
 * Handles dividend crediting based on holdings and yield
 */

import { pool } from './db-sql'

export interface DividendCalculation {
  symbol: string
  shares: number
  dividendPerShare: number
  grossAmount: number
  withholdTax: number
  netAmount: number
  currency: string
  exDate: Date
  recordDate: Date
  payDate: Date
}

/**
 * Get FX rate for currency conversion
 */
export async function getFXRate(fromCurrency: string, toCurrency: string, date: Date = new Date()): Promise<number> {
  if (fromCurrency === toCurrency) return 1.0

  const client = await pool.connect()
  try {
    // Try to get cached rate for today
    const dateStr = date.toISOString().split('T')[0]
    const result = await client.query(
      `SELECT rate FROM fx_rates 
       WHERE "fromCurrency" = $1 AND "toCurrency" = $2 AND date::date = $3::date
       ORDER BY date DESC LIMIT 1`,
      [fromCurrency, toCurrency, dateStr]
    )

    if (result.rows.length > 0) {
      return parseFloat(result.rows[0].rate)
    }

    // Fetch live rate (fallback to API or use default)
    // For USD-CAD, use approximate rate
    if (fromCurrency === 'USD' && toCurrency === 'CAD') {
      try {
        // Try to fetch from an FX API (you can add your preferred provider)
        const fxRes = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`)
        const fxData = await fxRes.json()
        const rate = fxData.rates?.CAD || 1.35 // Fallback to approximate
        
        // Cache the rate
        await client.query(
          `INSERT INTO fx_rates ("fromCurrency", "toCurrency", rate, date)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT ("fromCurrency", "toCurrency", date) DO UPDATE SET rate = $3`,
          [fromCurrency, toCurrency, rate, dateStr]
        )
        
        return rate
      } catch {
        return 1.35 // Default USD-CAD rate
      }
    }

    return 1.0
  } finally {
    client.release()
  }
}

/**
 * Calculate dividend for a position
 */
export function calculateDividend(
  shares: number,
  dividendPerShare: number,
  currency: string,
  userCurrency: string = 'USD',
  withholdTaxRate: number = 0.15 // Default 15% for US dividends to non-US residents
): { gross: number; tax: number; net: number } {
  const gross = shares * dividendPerShare
  const tax = gross * withholdTaxRate
  const net = gross - tax
  
  return { gross, tax, net }
}

/**
 * Process dividend payout for a user's holdings
 */
export async function processDividendPayout(
  userId: string,
  symbol: string,
  exDate: Date,
  recordDate: Date,
  payDate: Date,
  amountPerShare: number,
  currency: string
): Promise<void> {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')

    // Get user's portfolio
    const portfolioRes = await client.query(
      'SELECT id, "walletBalance", currency FROM portfolios WHERE "userId" = $1',
      [userId]
    )
    
    if (portfolioRes.rows.length === 0) {
      throw new Error('Portfolio not found')
    }

    const portfolio = portfolioRes.rows[0]
    const portfolioId = portfolio.id
    const walletCurrency = portfolio.currency || 'USD'

    // Get position on record date
    const positionRes = await client.query(
      `SELECT "totalShares" FROM positions 
       WHERE "portfolioId" = $1 AND symbol = $2 AND "totalShares" > 0`,
      [portfolioId, symbol]
    )

    if (positionRes.rows.length === 0) {
      // No position, skip
      await client.query('COMMIT')
      return
    }

    const shares = parseFloat(positionRes.rows[0].totalShares)

    // Get or create security
    let securityRes = await client.query(
      'SELECT id FROM securities WHERE symbol = $1',
      [symbol]
    )

    let securityId: string
    if (securityRes.rows.length === 0) {
      // Create security
      const insertRes = await client.query(
        `INSERT INTO securities (symbol, exchange, currency, "ttmDividendPerShare", "nextExDate")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [symbol, 'NYSE', currency, amountPerShare * 4, payDate] // Assume quarterly
      )
      securityId = insertRes.rows[0].id
    } else {
      securityId = securityRes.rows[0].id
    }

    // Get or create corporate action
    let caRes = await client.query(
      `SELECT id FROM corporate_actions 
       WHERE "securityId" = $1 AND "exDate" = $2 AND type = 'CASH_DIVIDEND'`,
      [securityId, exDate]
    )

    let corporateActionId: string
    if (caRes.rows.length === 0) {
      const insertRes = await client.query(
        `INSERT INTO corporate_actions 
         ("securityId", type, "exDate", "recordDate", "payDate", "amountPerShare", currency, status)
         VALUES ($1, 'CASH_DIVIDEND', $2, $3, $4, $5, $6, 'PENDING')
         RETURNING id`,
        [securityId, exDate, recordDate, payDate, amountPerShare, currency]
      )
      corporateActionId = insertRes.rows[0].id
    } else {
      corporateActionId = caRes.rows[0].id
    }

    // Calculate dividend
    const { gross, tax, net } = calculateDividend(shares, amountPerShare, currency, walletCurrency)

    // Get FX rate if needed
    let fxRate = 1.0
    let netAmountWallet = net
    if (currency !== walletCurrency) {
      fxRate = await getFXRate(currency, walletCurrency, payDate)
      netAmountWallet = net * fxRate
    }

    // Create dividend payout record
    const payoutRes = await client.query(
      `INSERT INTO dividend_payouts 
       ("portfolioId", "securityId", "corporateActionId", "qtyOnRecord", "grossAmount", 
        "withholdTax", "netAmount", currency, "fxRate", status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
       RETURNING id`,
      [portfolioId, securityId, corporateActionId, shares, gross, tax, net, currency, fxRate]
    )

    const payoutId = payoutRes.rows[0].id

    // Credit wallet on pay date
    if (payDate <= new Date()) {
      // Update wallet balance
      await client.query(
        'UPDATE portfolios SET "walletBalance" = "walletBalance" + $1 WHERE id = $2',
        [netAmountWallet, portfolioId]
      )

      // Create wallet transaction
      await client.query(
        `INSERT INTO wallet_transactions 
         ("portfolioId", action, amount, timestamp, "securityId", meta)
         VALUES ($1, 'DIVIDEND_CREDIT', $2, $3, $4, $5)`,
        [
          portfolioId,
          netAmountWallet,
          payDate,
          securityId,
          JSON.stringify({
            payoutId,
            symbol,
            shares,
            grossAmount: gross,
            tax,
            netAmount: net,
            currency,
            fxRate,
            netAmountWallet,
          }),
        ]
      )

      // Update payout status
      await client.query(
        'UPDATE dividend_payouts SET status = $1 WHERE id = $2',
        ['CREDITED', payoutId]
      )

      // Update corporate action status
      await client.query(
        'UPDATE corporate_actions SET status = $1 WHERE id = $2',
        ['PAID', corporateActionId]
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Get upcoming dividends for a user
 */
export async function getUpcomingDividends(userId: string): Promise<any[]> {
  const client = await pool.connect()
  
  try {
    const portfolioRes = await client.query(
      'SELECT id FROM portfolios WHERE "userId" = $1',
      [userId]
    )

    if (portfolioRes.rows.length === 0) return []

    const portfolioId = portfolioRes.rows[0].id

    // Get positions
    const positionsRes = await client.query(
      'SELECT symbol, "totalShares" FROM positions WHERE "portfolioId" = $1 AND "totalShares" > 0',
      [portfolioId]
    )

    const symbols = positionsRes.rows.map((r: any) => r.symbol)
    if (symbols.length === 0) return []

    // Get upcoming corporate actions
    const caRes = await client.query(
      `SELECT ca.*, s.symbol, s.name, s.currency, p."totalShares"
       FROM corporate_actions ca
       JOIN securities s ON ca."securityId" = s.id
       JOIN positions p ON p.symbol = s.symbol AND p."portfolioId" = $1
       WHERE ca.type = 'CASH_DIVIDEND' 
         AND ca.status = 'PENDING'
         AND ca."exDate" >= CURRENT_DATE
         AND s.symbol = ANY($2::text[])
       ORDER BY ca."exDate" ASC`,
      [portfolioId, symbols]
    )

    return caRes.rows.map((row: any) => ({
      symbol: row.symbol,
      name: row.name,
      shares: parseFloat(row.totalShares),
      exDate: row.exDate,
      recordDate: row.recordDate,
      payDate: row.payDate,
      amountPerShare: parseFloat(row.amountPerShare),
      currency: row.currency,
      estimatedGross: parseFloat(row.totalShares) * parseFloat(row.amountPerShare),
    }))
  } finally {
    client.release()
  }
}

/**
 * Get dividend history for a user
 */
export async function getDividendHistory(userId: string, limit: number = 50): Promise<any[]> {
  const client = await pool.connect()
  
  try {
    const portfolioRes = await client.query(
      'SELECT id FROM portfolios WHERE "userId" = $1',
      [userId]
    )

    if (portfolioRes.rows.length === 0) return []

    const portfolioId = portfolioRes.rows[0].id

    const result = await client.query(
      `SELECT dp.*, s.symbol, s.name, ca."exDate", ca."payDate"
       FROM dividend_payouts dp
       JOIN securities s ON dp."securityId" = s.id
       JOIN corporate_actions ca ON dp."corporateActionId" = ca.id
       WHERE dp."portfolioId" = $1
       ORDER BY ca."payDate" DESC
       LIMIT $2`,
      [portfolioId, limit]
    )

    return result.rows.map((row: any) => ({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      shares: parseFloat(row.qtyOnRecord),
      grossAmount: parseFloat(row.grossAmount),
      tax: parseFloat(row.withholdTax),
      netAmount: parseFloat(row.netAmount),
      currency: row.currency,
      fxRate: row.fxRate ? parseFloat(row.fxRate) : 1.0,
      exDate: row.exDate,
      payDate: row.payDate,
      status: row.status,
    }))
  } finally {
    client.release()
  }
}

