import { z } from 'zod'
import { prisma } from './db'

export const TradeAction = z.enum(['buy','sell'])

export const TradeInputSchema = z.object({
  symbol: z.string().min(1),
  action: TradeAction,
  price: z.number().positive(),
  quantity: z.number().positive(),
  note: z.string().optional(),
})

export const PositionSchema = z.object({
  symbol: z.string(),
  totalShares: z.number(),
  avgPrice: z.number(),
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
  timestamp: z.number(),
  note: z.string().optional(),
})

export type Transaction = z.infer<typeof TransactionSchema>
export type TradeInput = z.infer<typeof TradeInputSchema>
export type Position = z.infer<typeof PositionSchema>

// Helper to get or create demo user/portfolio
async function getOrCreateDemoPortfolio(userId: string) {
  if (userId === 'demo-user') {
    // Get or create demo user
    let user = await prisma.user.findUnique({ where: { email: 'demo@bullishai.com' } })
    if (!user) {
      user = await prisma.user.create({
        data: { email: 'demo@bullishai.com', name: 'Demo User' }
      })
    }
    
    // Get or create portfolio
    let portfolio = await prisma.portfolio.findUnique({ where: { userId: user.id } })
    if (!portfolio) {
      portfolio = await prisma.portfolio.create({
        data: { userId: user.id, walletBalance: 0 }
      })
    }
    return portfolio
  }
  
  // For real users, ensure portfolio exists
  let portfolio = await prisma.portfolio.findUnique({ where: { userId } })
  if (!portfolio) {
    portfolio = await prisma.portfolio.create({
      data: { userId, walletBalance: 0 }
    })
  }
  return portfolio
}

export async function initializeWalletFromBalance(userId: string, balance: number): Promise<void> {
  const portfolio = await getOrCreateDemoPortfolio(userId)
  const txCount = await prisma.walletTransaction.count({ where: { portfolioId: portfolio.id } })
  if (balance > 0 && portfolio.walletBalance === 0 && txCount === 0) {
    await prisma.portfolio.update({
      where: { id: portfolio.id },
      data: { walletBalance: balance }
    })
  }
}

export async function setWalletBalance(userId: string, balance: number): Promise<void> {
  const portfolio = await getOrCreateDemoPortfolio(userId)
  await prisma.portfolio.update({
    where: { id: portfolio.id },
    data: { walletBalance: balance }
  })
}

export async function listTransactions(userId: string): Promise<Transaction[]> {
  const portfolio = await getOrCreateDemoPortfolio(userId)
  const trades = await prisma.trade.findMany({
    where: { portfolioId: portfolio.id },
    orderBy: { timestamp: 'desc' }
  })
  return trades.map(t => ({
    id: t.id,
    symbol: t.symbol,
    action: t.action as 'buy' | 'sell',
    price: t.price,
    quantity: t.quantity,
    timestamp: t.timestamp.getTime(),
    note: t.note || undefined
  }))
}

export async function listPositions(userId: string): Promise<Position[]> {
  const portfolio = await getOrCreateDemoPortfolio(userId)
  const positions = await prisma.position.findMany({
    where: { 
      portfolioId: portfolio.id,
      totalShares: { gt: 0 } // Hide zero-share positions
    }
  })
  return positions.map(p => ({
    symbol: p.symbol,
    totalShares: p.totalShares,
    avgPrice: p.avgPrice,
    marketValue: 0,
    totalCost: p.totalCost,
    realizedPnl: p.realizedPnl
  }))
}

export async function mergePositions(userId: string, positions: Position[]): Promise<void> {
  const portfolio = await getOrCreateDemoPortfolio(userId)
  for (const p of positions) {
    const s = p.symbol.toUpperCase()
    await prisma.position.upsert({
      where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol: s } },
      update: {
        totalShares: p.totalShares,
        avgPrice: p.avgPrice,
        totalCost: p.totalCost ?? p.avgPrice * p.totalShares,
        realizedPnl: p.realizedPnl ?? 0
      },
      create: {
        portfolioId: portfolio.id,
        symbol: s,
        totalShares: p.totalShares,
        avgPrice: p.avgPrice,
        totalCost: p.totalCost ?? p.avgPrice * p.totalShares,
        realizedPnl: p.realizedPnl ?? 0
      }
    })
  }
}

export async function upsertTrade(userId: string, input: TradeInput): Promise<Position> {
  const portfolio = await getOrCreateDemoPortfolio(userId)
  const s = input.symbol.toUpperCase()
  
  const existing = await prisma.position.findUnique({
    where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol: s } }
  }) || { symbol: s, totalShares: 0, avgPrice: 0, totalCost: 0, realizedPnl: 0 }

  // Create trade record
  await prisma.trade.create({
    data: {
      portfolioId: portfolio.id,
      symbol: s,
      action: input.action,
      price: input.price,
      quantity: input.quantity,
      timestamp: new Date(),
      note: input.note
    }
  })

  if (input.action === 'buy') {
    const totalCost = input.price * input.quantity
    if (portfolio.walletBalance < totalCost) {
      throw new Error('insufficient_funds')
    }
    
    const newTotalCost = existing.totalCost + input.price * input.quantity
    const newTotalShares = existing.totalShares + input.quantity
    const newAvg = newTotalShares > 0 ? newTotalCost / newTotalShares : 0
    
    await prisma.portfolio.update({
      where: { id: portfolio.id },
      data: { walletBalance: { decrement: totalCost } }
    })
    
    const pos = await prisma.position.upsert({
      where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol: s } },
      update: {
        totalShares: newTotalShares,
        avgPrice: newAvg,
        totalCost: newTotalCost
      },
      create: {
        portfolioId: portfolio.id,
        symbol: s,
        totalShares: newTotalShares,
        avgPrice: newAvg,
        totalCost: newTotalCost,
        realizedPnl: existing.realizedPnl
      }
    })
    
    return {
      symbol: pos.symbol,
      totalShares: pos.totalShares,
      avgPrice: pos.avgPrice,
      marketValue: 0,
      totalCost: pos.totalCost,
      realizedPnl: pos.realizedPnl
    }
  } else {
    if (input.quantity > existing.totalShares) {
      throw new Error('insufficient_shares')
    }
    
    const sellQty = input.quantity
    const newTotalShares = existing.totalShares - sellQty
    const realized = (input.price - existing.avgPrice) * sellQty
    const newTotalCost = existing.avgPrice * newTotalShares
    
    await prisma.portfolio.update({
      where: { id: portfolio.id },
      data: { walletBalance: { increment: input.price * sellQty } }
    })
    
    const pos = await prisma.position.upsert({
      where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol: s } },
      update: {
        totalShares: newTotalShares,
        totalCost: newTotalCost,
        realizedPnl: existing.realizedPnl + realized
      },
      create: {
        portfolioId: portfolio.id,
        symbol: s,
        totalShares: newTotalShares,
        avgPrice: existing.avgPrice,
        totalCost: newTotalCost,
        realizedPnl: realized
      }
    })
    
    return {
      symbol: pos.symbol,
      totalShares: pos.totalShares,
      avgPrice: pos.avgPrice,
      marketValue: 0,
      totalCost: pos.totalCost,
      realizedPnl: pos.realizedPnl
    }
  }
}

export async function getWalletBalance(userId: string): Promise<number> {
  const portfolio = await getOrCreateDemoPortfolio(userId)
  return portfolio.walletBalance
}

export async function depositToWallet(userId: string, amount: number): Promise<number> {
  if (amount <= 0) throw new Error('invalid_amount')
  const portfolio = await getOrCreateDemoPortfolio(userId)
  const cap = 1_000_000
  const newBalance = Math.min(cap, portfolio.walletBalance + amount)
  
  await prisma.portfolio.update({
    where: { id: portfolio.id },
    data: { walletBalance: newBalance }
  })
  
  await prisma.walletTransaction.create({
    data: {
      portfolioId: portfolio.id,
      action: 'deposit',
      amount,
      timestamp: new Date()
    }
  })
  
  return newBalance
}

export async function withdrawFromWallet(userId: string, amount: number): Promise<number> {
  if (amount <= 0) throw new Error('invalid_amount')
  const portfolio = await getOrCreateDemoPortfolio(userId)
  if (portfolio.walletBalance < amount) throw new Error('insufficient_funds')
  
  const newBalance = portfolio.walletBalance - amount
  
  await prisma.portfolio.update({
    where: { id: portfolio.id },
    data: { walletBalance: newBalance }
  })
  
  await prisma.walletTransaction.create({
    data: {
      portfolioId: portfolio.id,
      action: 'withdraw',
      amount,
      timestamp: new Date()
    }
  })
  
  return newBalance
}

export async function listWalletTransactions(userId: string) {
  const portfolio = await getOrCreateDemoPortfolio(userId)
  const tx = await prisma.walletTransaction.findMany({
    where: { portfolioId: portfolio.id },
    orderBy: { timestamp: 'asc' }
  })
  return tx.map(t => ({
    action: t.action as 'deposit' | 'withdraw',
    amount: t.amount,
    timestamp: t.timestamp.getTime()
  }))
}
