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
}

const store: Record<string, Portfolio> = {}

function getPf(userId: string): Portfolio {
  if (!store[userId]) store[userId] = { positions: {}, transactions: [] }
  return store[userId]
}

export function listTransactions(userId: string): Transaction[] {
  const pf = getPf(userId)
  return pf.transactions.sort((a, b) => b.timestamp - a.timestamp) // Most recent first
}

export function listPositions(userId: string): Position[] {
  const pf = getPf(userId)
  return Object.values(pf.positions)
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
    const newTotalCost = existing.totalCost + input.price * input.quantity
    const newTotalShares = existing.totalShares + input.quantity
    const newAvg = newTotalShares > 0 ? newTotalCost / newTotalShares : 0
    pf.positions[s] = { ...existing, totalShares: newTotalShares, avgPrice: newAvg, totalCost: newTotalCost }
  } else {
    const sellQty = Math.min(existing.totalShares, input.quantity)
    const newTotalShares = existing.totalShares - sellQty
    const realized = (input.price - existing.avgPrice) * sellQty
    const newTotalCost = existing.avgPrice * newTotalShares
    pf.positions[s] = { ...existing, totalShares: newTotalShares, totalCost: newTotalCost, realizedPnl: existing.realizedPnl + realized }
  }

  return pf.positions[s]
}


