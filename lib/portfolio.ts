import { z } from 'zod'

export const TradeAction = z.enum(['buy','sell'])

export const TradeInputSchema = z.object({
  symbol: z.string().min(1),
  action: TradeAction,
  price: z.number().positive(),
  quantity: z.number().positive(),
  // optional client metadata
  note: z.string().optional(),
})

export const PositionSchema = z.object({
  symbol: z.string(),
  totalShares: z.number(),
  avgPrice: z.number(), // volume-weighted average cost
  marketValue: z.number().default(0),
  totalCost: z.number().default(0),
  realizedPnl: z.number().default(0),
})

export const TransactionSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  action: TradeAction,
  price: z.number(),
  quantity: z.number(),
  timestamp: z.number(), // Unix timestamp in milliseconds
  fees: z.number().optional(), // Optional transaction fees
  note: z.string().optional(),
})

export type Transaction = z.infer<typeof TransactionSchema>

export type TradeInput = z.infer<typeof TradeInputSchema>
export type Position = z.infer<typeof PositionSchema>

type Portfolio = {
  positions: Record<string, Position>
  transactions: Transaction[] // Store all buy/sell transactions with timestamps
  walletBalance: number
  walletTransactions?: Array<{ 
    id?: string
    action: 'deposit'|'withdraw'
    amount: number
    timestamp: number
    method?: string
    resultingBalance?: number
    idempotencyKey?: string
  }>
}

const store: Record<string, Portfolio> = {}
const dbLoadPromises: Record<string, Promise<void>> = {}

/**
 * Load portfolio from database into in-memory store
 * This is called once per user session to hydrate the in-memory store
 */
async function loadPortfolioFromDB(userId: string): Promise<void> {
  if (dbLoadPromises[userId]) {
    await dbLoadPromises[userId]
    return
  }

  const loadPromise = (async () => {
    try {
      const { loadPortfolioFromDB: loadFromDB } = await import('@/lib/portfolio-db')
      const dbData = await loadFromDB(userId)
      
      // Convert positions array to object format
      const positionsObj: Record<string, Position> = {}
      dbData.positions.forEach(p => {
        positionsObj[p.symbol] = p
      })
      
      store[userId] = {
        positions: positionsObj,
        transactions: dbData.transactions,
        walletBalance: dbData.walletBalance,
        walletTransactions: dbData.walletTransactions,
      }
    } catch (error) {
      console.error(`Error loading portfolio from DB for user ${userId}:`, error)
      // Fallback to empty portfolio if DB load fails
      store[userId] = {
        positions: {},
        transactions: [],
        walletBalance: 0,
        walletTransactions: [],
      }
    } finally {
      delete dbLoadPromises[userId]
    }
  })()

  dbLoadPromises[userId] = loadPromise
  await loadPromise
}

function getPf(userId: string): Portfolio {
  // Always initialize empty portfolio for new users
  // This ensures new users start with $0 and no holdings
  if (!store[userId]) {
    store[userId] = { 
      positions: {}, 
      transactions: [], 
      walletBalance: 0, 
      walletTransactions: [] 
    }
    // Load from DB in background (non-blocking)
    loadPortfolioFromDB(userId).catch(err => {
      console.error('Background DB load failed:', err)
    })
  }
  return store[userId]
}

/**
 * Ensure portfolio is loaded from DB (for API routes)
 */
export async function ensurePortfolioLoaded(userId: string): Promise<void> {
  if (!store[userId]) {
    await loadPortfolioFromDB(userId)
  }
}

// Initialize wallet from persisted balance (called from API routes)
// Only initializes if user has no existing transactions (new user)
export function initializeWalletFromBalance(userId: string, balance: number): void {
  const pf = getPf(userId)
  // Only initialize if:
  // 1. Balance is provided and > 0
  // 2. Current wallet balance is 0 (new user)
  // 3. No wallet transactions exist (truly new user)
  // 4. No portfolio transactions exist (no trades yet)
  if (balance > 0 && 
      pf.walletBalance === 0 && 
      (!pf.walletTransactions || pf.walletTransactions.length === 0) &&
      (!pf.transactions || pf.transactions.length === 0)) {
    pf.walletBalance = balance
  }
  // For new users, always ensure balance is 0 if no transactions exist
  if ((!pf.walletTransactions || pf.walletTransactions.length === 0) &&
      (!pf.transactions || pf.transactions.length === 0) &&
      Object.keys(pf.positions).length === 0) {
    pf.walletBalance = 0
  }
}

// Sync wallet balance (update in-memory store)
export function setWalletBalance(userId: string, balance: number): void {
  getPf(userId).walletBalance = balance
}

export function listTransactions(userId: string): Transaction[] {
  const pf = getPf(userId)
  return pf.transactions.sort((a, b) => b.timestamp - a.timestamp) // Most recent first
}

export function listPositions(userId: string): Position[] {
  const pf = getPf(userId)
  // Hide empty positions (0 shares)
  return Object.values(pf.positions).filter(p => (p.totalShares || 0) > 0)
}

// Merge a client-provided snapshot of positions into the server portfolio store.
// Existing positions are overwritten by the snapshot for the same symbol.
export function mergePositions(userId: string, positions: Position[]): void {
  const pf = getPf(userId)
  for (const p of positions) {
    const s = p.symbol.toUpperCase()
    pf.positions[s] = {
      symbol: s,
      totalShares: p.totalShares,
      avgPrice: p.avgPrice,
      marketValue: p.marketValue ?? 0,
      totalCost: p.totalCost ?? p.avgPrice * p.totalShares,
      realizedPnl: p.realizedPnl ?? 0,
    }
  }
}

export async function upsertTrade(userId: string, input: TradeInput): Promise<{ position: Position; transaction: Transaction }> {
  // Ensure portfolio is loaded from DB
  await ensurePortfolioLoaded(userId)
  
  const pf = getPf(userId)
  const s = input.symbol.toUpperCase()
  const existing = pf.positions[s] || { symbol: s, totalShares: 0, avgPrice: 0, marketValue: 0, totalCost: 0, realizedPnl: 0 }

  // Create transaction record with timestamp
  const transaction: Transaction = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    symbol: s,
    action: input.action,
    price: input.price,
    quantity: input.quantity,
    timestamp: Date.now(), // Store current timestamp
    note: input.note,
  }
  
  // Add transaction to history
  pf.transactions.push(transaction)

  if (input.action === 'buy') {
    const totalCost = input.price * input.quantity
    const currentBalance = pf.walletBalance || 0
    if (currentBalance < totalCost) {
      throw new Error('insufficient_funds')
    }
    // Subtract cost from wallet (simple subtraction)
    pf.walletBalance = currentBalance - totalCost
    const newTotalCost = existing.totalCost + input.price * input.quantity
    const newTotalShares = existing.totalShares + input.quantity
    const newAvg = newTotalShares > 0 ? newTotalCost / newTotalShares : 0
    pf.positions[s] = { ...existing, totalShares: newTotalShares, avgPrice: newAvg, totalCost: newTotalCost }
  } else {
    if (input.quantity > existing.totalShares) {
      throw new Error('insufficient_shares')
    }
    const sellQty = input.quantity
    const newTotalShares = existing.totalShares - sellQty
    const realized = (input.price - existing.avgPrice) * sellQty
    const newTotalCost = existing.avgPrice * newTotalShares
    pf.positions[s] = { ...existing, totalShares: newTotalShares, totalCost: newTotalCost, realizedPnl: existing.realizedPnl + realized }
    // Add proceeds to wallet (simple addition)
    const currentBalance = pf.walletBalance || 0
    const proceeds = input.price * sellQty
    pf.walletBalance = currentBalance + proceeds
  }

  // Save to database (non-blocking)
  const { savePositionToDB, saveTradeToDB, updateWalletBalanceInDB } = await import('@/lib/portfolio-db')
  Promise.all([
    savePositionToDB(userId, pf.positions[s]),
    saveTradeToDB(userId, transaction),
    updateWalletBalanceInDB(userId, pf.walletBalance),
  ]).catch(err => {
    console.error('Error saving trade to DB:', err)
  })

  return { position: pf.positions[s], transaction }
}

// Wallet helpers
export function getWalletBalance(userId: string): number {
  return getPf(userId).walletBalance
}

export async function depositToWallet(userId: string, amount: number, method: string = 'Manual', idempotencyKey?: string): Promise<{ balance: number; transaction: any }> {
  // Ensure portfolio is loaded from DB
  await ensurePortfolioLoaded(userId)
  
  if (amount <= 0) throw new Error('invalid_amount')
  if (amount > 1_000_000) throw new Error('amount_exceeds_cap')
  
  // Validate decimal places (max 2)
  const roundedAmount = Math.round(amount * 100) / 100
  if (Math.abs(amount - roundedAmount) > 0.001) {
    throw new Error('amount_too_many_decimals')
  }
  
  const pf = getPf(userId)
  const cap = 1_000_000
  const oldBalance = pf.walletBalance || 0
  const newBalance = Math.min(cap, oldBalance + roundedAmount)
  
  // Check if transaction already exists (idempotency)
  if (idempotencyKey && pf.walletTransactions) {
    const exists = pf.walletTransactions.some((tx: any) => tx.idempotencyKey === idempotencyKey)
    if (exists) {
      // Return existing transaction result
      const existingTx = pf.walletTransactions.find((tx: any) => tx.idempotencyKey === idempotencyKey)
      return { balance: existingTx?.resultingBalance || pf.walletBalance, transaction: existingTx }
    }
  }
  
  // Atomically update balance: ADD the amount (simple addition)
  pf.walletBalance = newBalance
  
  const timestamp = Date.now()
  const transaction = {
    id: `${userId}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
    action: 'deposit' as const,
    amount: roundedAmount,
    timestamp,
    method: method || 'Manual',
    resultingBalance: newBalance,
    idempotencyKey: idempotencyKey || undefined
  }
  
  try { 
    if (!pf.walletTransactions) pf.walletTransactions = []
    pf.walletTransactions.push(transaction)
  } catch {}
  
  // Save to database (non-blocking)
  const { saveWalletTransactionToDB } = await import('@/lib/portfolio-db')
  saveWalletTransactionToDB(userId, transaction).catch(err => {
    console.error('Error saving wallet transaction to DB:', err)
  })
  
  return { balance: pf.walletBalance, transaction }
}

export async function withdrawFromWallet(userId: string, amount: number, method: string = 'Manual', idempotencyKey?: string): Promise<{ balance: number; transaction: any }> {
  // Ensure portfolio is loaded from DB
  await ensurePortfolioLoaded(userId)
  
  if (amount <= 0) throw new Error('invalid_amount')
  
  // Validate decimal places (max 2)
  const roundedAmount = Math.round(amount * 100) / 100
  if (Math.abs(amount - roundedAmount) > 0.001) {
    throw new Error('amount_too_many_decimals')
  }
  
  const pf = getPf(userId)
  const oldBalance = pf.walletBalance || 0
  if (oldBalance < roundedAmount) throw new Error('insufficient_funds')
  
  // Check if transaction already exists (idempotency)
  if (idempotencyKey && pf.walletTransactions) {
    const exists = pf.walletTransactions.some((tx: any) => tx.idempotencyKey === idempotencyKey)
    if (exists) {
      // Return existing transaction result
      const existingTx = pf.walletTransactions.find((tx: any) => tx.idempotencyKey === idempotencyKey)
      return { balance: existingTx?.resultingBalance || pf.walletBalance, transaction: existingTx }
    }
  }
  
  // Atomically update balance: SUBTRACT the amount (simple subtraction)
  const newBalance = oldBalance - roundedAmount
  pf.walletBalance = newBalance
  
  const timestamp = Date.now()
  const transaction = {
    id: `${userId}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
    action: 'withdraw' as const,
    amount: roundedAmount,
    timestamp,
    method: method || 'Manual',
    resultingBalance: newBalance,
    idempotencyKey: idempotencyKey || undefined
  }
  
  try { 
    if (!pf.walletTransactions) pf.walletTransactions = []
    pf.walletTransactions.push(transaction)
  } catch {}
  
  // Save to database (non-blocking)
  const { saveWalletTransactionToDB } = await import('@/lib/portfolio-db')
  saveWalletTransactionToDB(userId, transaction).catch(err => {
    console.error('Error saving wallet transaction to DB:', err)
  })
  
  return { balance: pf.walletBalance, transaction }
}

export function listWalletTransactions(userId: string) {
  return (getPf(userId).walletTransactions || []).slice().sort((a,b)=>a.timestamp-b.timestamp)
}

// Sync transactions from client (for persistence)
export function syncTransactions(userId: string, transactions: Transaction[]): void {
  const pf = getPf(userId)
  // Merge transactions, avoiding duplicates by id
  const existingIds = new Set(pf.transactions.map(t => t.id))
  for (const tx of transactions) {
    if (!existingIds.has(tx.id)) {
      pf.transactions.push(tx)
    }
  }
  // Sort by timestamp
  pf.transactions.sort((a, b) => a.timestamp - b.timestamp)
}

// Sync wallet transactions from client
export function syncWalletTransactions(userId: string, walletTx: Array<{ action: 'deposit'|'withdraw'; amount: number; timestamp: number }>): void {
  const pf = getPf(userId)
  if (!pf.walletTransactions) pf.walletTransactions = []
  const existingIds = new Set(pf.walletTransactions.map((w: any) => `${w.timestamp}-${w.amount}-${w.action}`))
  for (const wt of walletTx) {
    const id = `${wt.timestamp}-${wt.amount}-${wt.action}`
    if (!existingIds.has(id)) {
      pf.walletTransactions.push(wt)
    }
  }
  pf.walletTransactions.sort((a, b) => a.timestamp - b.timestamp)
}


