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

export type TradeInput = z.infer<typeof TradeInputSchema>
export type Position = z.infer<typeof PositionSchema>

type Portfolio = {
  positions: Record<string, Position>
}

const store: Record<string, Portfolio> = {}

function getPf(userId: string): Portfolio {
  if (!store[userId]) store[userId] = { positions: {} }
  return store[userId]
}

export function listPositions(userId: string): Position[] {
  const pf = getPf(userId)
  return Object.values(pf.positions)
}

export function upsertTrade(userId: string, input: TradeInput): Position {
  const pf = getPf(userId)
  const s = input.symbol.toUpperCase()
  const existing = pf.positions[s] || { symbol: s, totalShares: 0, avgPrice: 0, marketValue: 0, totalCost: 0, realizedPnl: 0 }

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


