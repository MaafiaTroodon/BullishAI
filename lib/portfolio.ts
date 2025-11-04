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
  note: z.string().optional(),
})

export type Transaction = z.infer<typeof TransactionSchema>

export type TradeInput = z.infer<typeof TradeInputSchema>
export type Position = z.infer<typeof PositionSchema>

type Portfolio = {
  positions: Record<string, Position>
  transactions: Transaction[] // Store all buy/sell transactions with timestamps
  walletBalance: number
  walletTransactions?: Array<{ action: 'deposit'|'withdraw'; amount: number; timestamp: number }>
}

const store: Record<string, Portfolio> = {}

function getPf(userId: string): Portfolio {
  if (!store[userId]) store[userId] = { positions: {}, transactions: [], walletBalance: 0, walletTransactions: [] }
  return store[userId]
}

// Initialize wallet from persisted balance (called from API routes)
export function initializeWalletFromBalance(userId: string, balance: number): void {
  const pf = getPf(userId)
  if (balance > 0 && (pf.walletBalance === 0 || !pf.walletTransactions || pf.walletTransactions.length === 0)) {
    // Only initialize if we don't have transactions (fresh start)
    pf.walletBalance = balance
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

export function upsertTrade(userId: string, input: TradeInput): Position {
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
    if (pf.walletBalance < totalCost) {
      throw new Error('insufficient_funds')
    }
    pf.walletBalance -= totalCost
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
    // credit proceeds
    pf.walletBalance += input.price * sellQty
  }

  return pf.positions[s]
}

// Wallet helpers
export function getWalletBalance(userId: string): number {
  return getPf(userId).walletBalance
}

export function depositToWallet(userId: string, amount: number): number {
  if (amount <= 0) throw new Error('invalid_amount')
  const pf = getPf(userId)
  const cap = 1_000_000
  const newBalance = Math.min(cap, pf.walletBalance + amount)
  pf.walletBalance = newBalance
  try { pf.walletTransactions!.push({ action: 'deposit', amount, timestamp: Date.now() }) } catch {}
  return pf.walletBalance
}

export function withdrawFromWallet(userId: string, amount: number): number {
  if (amount <= 0) throw new Error('invalid_amount')
  const pf = getPf(userId)
  if (pf.walletBalance < amount) throw new Error('insufficient_funds')
  pf.walletBalance -= amount
  try { pf.walletTransactions!.push({ action: 'withdraw', amount, timestamp: Date.now() }) } catch {}
  return pf.walletBalance
}

export function listWalletTransactions(userId: string) {
  return (getPf(userId).walletTransactions || []).slice().sort((a,b)=>a.timestamp-b.timestamp)
}


