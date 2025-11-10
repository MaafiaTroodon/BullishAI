import { NextRequest, NextResponse } from 'next/server'
import { TradeInputSchema, listPositions, upsertTrade, getWalletBalance, initializeWalletFromBalance, TransactionSchema, syncTransactions, syncWalletTransactions, ensurePortfolioLoaded } from '@/lib/portfolio'
import { getUserId } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = new URL(req.url)
  const enrich = url.searchParams.get('enrich') === '1'
  const includeTransactions = url.searchParams.get('transactions') === '1'
  
  // Load portfolio from database first (ensures data persists across logouts)
  const { ensurePortfolioLoaded } = await import('@/lib/portfolio')
  await ensurePortfolioLoaded(userId)
  
  // User-specific cookie name to prevent cross-user data sharing
  const cookieName = `bullish_wallet_${userId}`
  
  // Get current wallet balance from in-memory store (now loaded from DB)
  let bal = getWalletBalance(userId)
  
  // Check if this is a new user (no positions, no transactions)
  const items = listPositions(userId)
  const { listTransactions, listWalletTransactions } = await import('@/lib/portfolio')
  const transactions = listTransactions(userId)
  const walletTransactions = listWalletTransactions(userId)
  const isNewUser = items.length === 0 && transactions.length === 0 && walletTransactions.length === 0
  
  // For new users, always start with $0 balance (don't restore from cookie)
  // Only restore from cookie if user has existing activity (legacy support)
  if (!isNewUser) {
    try {
      const cookieBal = req.cookies.get(cookieName)?.value
      if (cookieBal) {
        const parsed = Number(cookieBal)
        if (!Number.isNaN(parsed) && parsed >= 0 && bal === 0) {
          // Only restore from cookie if DB balance is 0 (migration scenario)
          initializeWalletFromBalance(userId, parsed)
          bal = parsed
        }
      }
    } catch {}
  } else {
    // New user: ensure balance is 0
    bal = 0
  }
  
  // Ensure balance is never negative
  bal = Math.max(0, bal)
  
  const response: any = { items, wallet: { balance: bal, cap: 1_000_000 } }
  
  // Include transaction history if requested
  if (includeTransactions) {
    const { listTransactions } = await import('@/lib/portfolio')
    response.transactions = listTransactions(userId)
  }
  
  if (!enrich || items.length === 0) {
    const res = NextResponse.json(response)
    try { res.cookies.set(cookieName, String(bal), { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 }) } catch {}
    return res
  }

  // Enrich with fast concurrent quotes from our own quote endpoint
  const enriched = await Promise.all(items.map(async (p) => {
    try {
      // Determine base URL dynamically
      const protocol = req.headers.get('x-forwarded-proto') || 'http'
      const host = req.headers.get('host') || 'localhost:3000'
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
      
      const r = await fetch(`${baseUrl}/api/quote?symbol=${encodeURIComponent(p.symbol)}`, { 
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!r.ok) {
        throw new Error(`Quote API returned ${r.status}`)
      }
      
      const contentType = r.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Quote API returned non-JSON response')
      }
      
      const j = await r.json()
      const price = j?.data?.price ?? j?.price ?? null
      const totalValue = price ? price * p.totalShares : 0
      const base = (p.totalCost || p.avgPrice * p.totalShares) || 0
      const unreal = price ? (price - p.avgPrice) * p.totalShares : 0
      const unrealPct = base > 0 ? (unreal / base) * 100 : 0
      return { 
        ...p, 
        currentPrice: price, 
        totalValue, 
        unrealizedPnl: unreal, 
        unrealizedPnlPct: unrealPct,
        totalCost: p.totalCost || p.avgPrice * p.totalShares || 0
      }
    } catch (err: any) {
      console.error(`Error enriching position ${p.symbol}:`, err.message)
      return { 
        ...p, 
        currentPrice: null, 
        totalValue: 0, 
        unrealizedPnl: 0, 
        unrealizedPnlPct: 0,
        totalCost: p.totalCost || p.avgPrice * p.totalShares || 0
      }
    }
  }))
  const res = NextResponse.json({ items: enriched, wallet: { balance: bal, cap: 1_000_000 } }, {
    headers: {
      'Content-Type': 'application/json',
    }
  })
  try { res.cookies.set(cookieName, String(bal), { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 }) } catch {}
  return res
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const body = await req.json()

    // Optional: bulk sync positions snapshot from client localStorage
    if (Array.isArray(body?.syncPositions)) {
      const { PositionSchema, mergePositions } = await import('@/lib/portfolio')
      const validated: any[] = []
      for (const p of body.syncPositions) {
        try { validated.push(PositionSchema.parse(p)) } catch {}
      }
      if (validated.length > 0) {
        await mergePositions(userId, validated)
      }
    }

    // Optional: sync transactions from client localStorage
    if (Array.isArray(body?.syncTransactions)) {
      const validated: any[] = []
      for (const tx of body.syncTransactions) {
        try { validated.push(TransactionSchema.parse(tx)) } catch {}
      }
      if (validated.length > 0) {
        syncTransactions(userId, validated)
      }
    }

    // Optional: sync wallet transactions from client localStorage
    if (Array.isArray(body?.syncWalletTransactions)) {
      syncWalletTransactions(userId, body.syncWalletTransactions)
    }

    // Process single trade
    if (body && body.symbol) {
      // User-specific cookie name to prevent cross-user data sharing
      const cookieName = `bullish_wallet_${userId}`
      
      // Restore wallet from user-specific cookie before processing trade
      try {
        const cookieBal = req.cookies.get(cookieName)?.value
        if (cookieBal) {
          const parsed = Number(cookieBal)
          if (!Number.isNaN(parsed) && parsed > 0) {
            initializeWalletFromBalance(userId, parsed)
          }
        }
      } catch {}
      
      const input = TradeInputSchema.parse(body)
      try {
        // Ensure portfolio is loaded before trade
        const { ensurePortfolioLoaded } = await import('@/lib/portfolio')
        await ensurePortfolioLoaded(userId)
        
        const result = await upsertTrade(userId, input)
        
        // Get fresh snapshot of all holdings and wallet after trade
        const updatedBal = getWalletBalance(userId)
        const allPositions = listPositions(userId)
        const { listTransactions } = await import('@/lib/portfolio')
        const allTransactions = listTransactions(userId)
        
        // Calculate portfolio totals
        const totalCost = allPositions.reduce((sum, p) => sum + (p.totalCost || p.avgPrice * p.totalShares || 0), 0)
        const totalReturn = allPositions.reduce((sum, p) => sum + (p.realizedPnl || 0), 0)
        
        // Return complete fresh snapshot for client to use
        const res = NextResponse.json({ 
          // Single item that was traded (for backward compatibility)
          item: result.position, 
          transaction: result.transaction,
          // Complete fresh snapshot
          holdings: allPositions,
          wallet: { balance: updatedBal, cap: 1_000_000 },
          totals: {
            costBasis: totalCost,
            totalReturn: totalReturn,
            totalReturnPct: totalCost > 0 ? (totalReturn / totalCost) * 100 : 0,
          },
          // Cache invalidation hint
          _invalidated: true,
        })
        
        // Persist wallet balance to user-specific cookie after trade
        try { res.cookies.set(cookieName, String(updatedBal), { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 }) } catch {}
        
        // Trigger cache invalidation headers
        try { 
          res.headers.set('X-Wallet-Updated', 'true')
          res.headers.set('X-Portfolio-Updated', 'true')
          res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
        } catch {}
        
        return res
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'trade_failed' }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'invalid_trade' }, { status: 400 })
  }
}


