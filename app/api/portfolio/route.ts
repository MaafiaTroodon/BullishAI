import { NextRequest, NextResponse } from 'next/server'
import { TradeInputSchema, listPositions, upsertTrade, getWalletBalance, initializeWalletFromBalance, TransactionSchema, syncTransactions, syncWalletTransactions, ensurePortfolioLoaded } from '@/lib/portfolio'
import { getLatestPortfolioSnapshot, type PortfolioSnapshot } from '@/lib/portfolio-snapshots'
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
    response.transactions = transactions
  }
  
  if (!enrich || items.length === 0) {
    const res = NextResponse.json(response)
    try { res.cookies.set(cookieName, String(bal), { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 }) } catch {}
    return res
  }

  const respondWithSnapshot = async (snapshot: PortfolioSnapshot | null, reason: string) => {
    console.warn(`[portfolio] Falling back to snapshot data (${reason})`)
    let enriched: any[] = []

    if (snapshot?.details?.holdings && Array.isArray(snapshot.details.holdings) && snapshot.details.holdings.length > 0) {
      // Use snapshot holdings - these have the actual market values from when snapshot was saved
      enriched = snapshot.details.holdings.map((h: any) => {
        const fallbackPosition = items.find(p => p.symbol === h.symbol)
        const shares = h.shares ?? h.totalShares ?? fallbackPosition?.totalShares ?? 0
        const avgPrice = h.avgPrice ?? fallbackPosition?.avgPrice ?? 0
        const baseCost = h.costBasis ?? h.totalCost ?? fallbackPosition?.totalCost ?? (avgPrice * shares || 0)
        
        // CRITICAL: Use snapshot's stored marketValue - this is the actual value from when quote was fetched
        // Don't fall back to cost basis unless marketValue is truly missing
        const snapshotMarketValue = h.marketValue ?? h.totalValue ?? null
        const totalValue = (snapshotMarketValue && snapshotMarketValue > 0) 
          ? snapshotMarketValue 
          : (baseCost > 0 ? baseCost : 0) // Only use cost if no market value at all
        
        const currentPrice = h.currentPrice ?? (shares > 0 && totalValue > 0 ? totalValue / shares : null)
        const unrealizedPnl = totalValue - baseCost
        const unrealizedPnlPct = baseCost > 0 ? (unrealizedPnl / baseCost) * 100 : 0
        
        return {
          symbol: h.symbol,
          totalShares: shares,
          avgPrice,
          currentPrice,
          totalValue,
          unrealizedPnl,
          unrealizedPnlPct,
          totalCost: baseCost,
          realizedPnl: fallbackPosition?.realizedPnl || 0,
        }
      })
    } else {
      // No snapshot holdings - use current positions from DB (which have cost basis from transactions)
      // When quotes fail, use cost basis as value so returns show 0% instead of -100%
      enriched = items.map((p: any) => {
        const shares = p.totalShares || 0
        // CRITICAL: Use totalCost from DB position (calculated from actual buy transactions)
        const cost = p.totalCost || (p.avgPrice * shares) || 0
        
        // Try to get current price/value from position if available (may not exist on Position type)
        const currentPriceFromPos = p.currentPrice && typeof p.currentPrice === 'number' && p.currentPrice > 0 ? p.currentPrice : null
        const derivedValueFromPrice = currentPriceFromPos ? currentPriceFromPos * shares : null
        const hasExistingValue = p.totalValue && typeof p.totalValue === 'number' && p.totalValue > 0
        
        // If we have a market value, use it; otherwise use cost basis (so returns show 0%, not -100%)
        const totalValue = hasExistingValue 
          ? p.totalValue 
          : (derivedValueFromPrice && derivedValueFromPrice > 0 
              ? derivedValueFromPrice 
              : cost) // Fallback to cost basis if no price available
        
        const currentPrice = currentPriceFromPos || (shares > 0 && totalValue > 0 ? totalValue / shares : null)
        
        const unrealizedPnl = totalValue - cost
        const unrealizedPnlPct = cost > 0 ? (unrealizedPnl / cost) * 100 : 0
        
        return {
          ...p,
          currentPrice,
          totalValue,
          unrealizedPnl,
          unrealizedPnlPct,
          totalCost: cost,
        }
      })
    }

    const responseBody: any = { items: enriched, wallet: { balance: bal, cap: 1_000_000 } }

    if (snapshot) {
      responseBody.totals = {
        tpv: snapshot.tpv,
        costBasis: snapshot.costBasis,
        totalReturn: snapshot.totalReturn,
        totalReturnPct: snapshot.totalReturnPct,
      }
      responseBody.lastUpdated = snapshot.timestamp
    } else {
      const fallbackCost = enriched.reduce((sum, h: any) => sum + (h.totalCost || 0), 0)
      const fallbackValue = enriched.reduce((sum, h: any) => sum + (h.totalValue || 0), 0)
      responseBody.totals = {
        tpv: fallbackValue,
        costBasis: fallbackCost,
        totalReturn: fallbackValue - fallbackCost,
        totalReturnPct: fallbackCost > 0 ? ((fallbackValue - fallbackCost) / fallbackCost) * 100 : 0,
      }
      responseBody.lastUpdated = Date.now()
    }

    const res = NextResponse.json(responseBody)
    try { res.cookies.set(cookieName, String(bal), { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 }) } catch {}
    return res
  }

  // Check for recent snapshot first (within last hour) - use it if quotes are failing
  const snapshot = await getLatestPortfolioSnapshot(userId)
  const snapshotAge = snapshot ? Date.now() - snapshot.timestamp : Infinity
  const isSnapshotRecent = snapshotAge < 60 * 60 * 1000 // 1 hour

  // Fetch prices from /api/stocks/${symbol} for each holding (same as stock page - has fallback logic)
  // This ensures we get prices even when /api/quote fails (502 errors)
  try {
    const protocol = req.headers.get('x-forwarded-proto') || 'http'
    const host = req.headers.get('host') || 'localhost:3000'
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
    
    // Fetch prices for all holdings in parallel (same endpoint stock page uses)
    const enriched = await Promise.all(items.map(async (p: any) => {
      const shares = p.totalShares || 0
      const costBasis = p.totalCost || (p.avgPrice * shares) || 0
      
      // Fetch price from /api/stocks/${symbol} (has fallback to candles if quote fails)
      let currentPrice: number | null = null
      try {
        const stockRes = await fetch(`${baseUrl}/api/stocks/${p.symbol}`, {
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' }
        })
        if (stockRes.ok) {
          const stockData = await stockRes.json()
          currentPrice = stockData?.quote?.price || null
        }
      } catch (err: any) {
        console.error(`Failed to fetch stock price for ${p.symbol}:`, err.message)
      }
      
      // Calculate market value: use currentPrice if available, otherwise use costBasis (so returns show 0%, not -100%)
      const marketValue = currentPrice && currentPrice > 0 
        ? currentPrice * shares 
        : costBasis
      
      const unrealizedPnl = marketValue - costBasis
      const unrealizedPnlPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0
      
      return {
        symbol: p.symbol,
        totalShares: shares,
        avgPrice: p.avgPrice,
        currentPrice,
        totalValue: marketValue,
        unrealizedPnl,
        unrealizedPnlPct,
        totalCost: costBasis,
        realizedPnl: p.realizedPnl || 0,
      }
    }))
    
    // Check if we got any live prices
    const hasLiveQuotes = enriched.some((h) => h.currentPrice && h.currentPrice > 0)
    
    // Debug logging
    console.log(`[portfolio] Fetched prices from /api/stocks - hasLiveQuotes: ${hasLiveQuotes}, items: ${items.length}`)
    if (enriched.length > 0) {
      const sample = enriched[0]
      console.log(`[portfolio] Sample: ${sample.symbol}, currentPrice: ${sample.currentPrice}, totalValue: ${sample.totalValue}, costBasis: ${sample.totalCost}`)
    }
    
    // CRITICAL: Only save snapshot if we have REAL market prices (not costBasis fallback)
    // Check that tpv is calculated from actual currentPrice values, not costBasis
    const calculatedTPV = enriched.reduce((sum, h) => sum + (h.totalValue || 0), 0)
    const calculatedCostBasis = enriched.reduce((sum, h) => sum + (h.totalCost || 0), 0)
    const hasRealPrices = enriched.some((h) => h.currentPrice && h.currentPrice > 0 && h.totalValue !== h.totalCost)
    
    // Only save if:
    // 1. We have live quotes AND
    // 2. TPV is different from costBasis (showing real market movement) AND
    // 3. TPV > 0
    if (hasLiveQuotes && hasRealPrices && calculatedTPV > 0 && Math.abs(calculatedTPV - calculatedCostBasis) > 0.01) {
      const { savePortfolioSnapshot } = await import('@/lib/portfolio-mark-to-market')
      const mtm = {
        tpv: calculatedTPV, // Use calculated TPV from actual market prices
        costBasis: calculatedCostBasis,
        totalReturn: calculatedTPV - calculatedCostBasis,
        totalReturnPct: calculatedCostBasis > 0 ? ((calculatedTPV - calculatedCostBasis) / calculatedCostBasis) * 100 : 0,
        holdings: enriched.map(h => ({
          symbol: h.symbol,
          shares: h.totalShares,
          avgPrice: h.avgPrice,
          currentPrice: h.currentPrice,
          marketValue: h.totalValue,
          unrealizedPnl: h.unrealizedPnl,
          unrealizedPnlPct: h.unrealizedPnlPct,
          costBasis: h.totalCost,
        })),
        walletBalance: bal,
        lastUpdated: Date.now(),
      }
      
      // CRITICAL: Log to verify we're saving real values
      console.log(`[portfolio] Saving snapshot with REAL tpv: $${mtm.tpv.toLocaleString()}, costBasis: $${mtm.costBasis.toLocaleString()}, return: ${mtm.totalReturnPct.toFixed(2)}%`)
    
    // Save snapshot asynchronously (don't block response)
    savePortfolioSnapshot(userId, mtm).catch(err => {
      console.error('Error saving portfolio snapshot:', err)
    })
    } else {
      if (!hasRealPrices) {
        console.log(`[portfolio] Skipping snapshot: No real prices (all holdings using costBasis fallback)`)
      } else if (Math.abs(calculatedTPV - calculatedCostBasis) <= 0.01) {
        console.log(`[portfolio] Skipping snapshot: tpv=$${calculatedTPV.toLocaleString()} equals costBasis (no market movement)`)
      }
    }
    
    // Calculate totals from enriched holdings (reuse variables already calculated above)
    const calculatedReturn = calculatedTPV - calculatedCostBasis
    const calculatedReturnPct = calculatedCostBasis > 0 ? (calculatedReturn / calculatedCostBasis) * 100 : 0
    
    const res = NextResponse.json({ 
      items: enriched, 
      wallet: { balance: bal, cap: 1_000_000 },
      totals: {
        tpv: calculatedTPV,
        costBasis: calculatedCostBasis,
        totalReturn: calculatedReturn,
        totalReturnPct: calculatedReturnPct,
      },
      lastUpdated: Date.now(),
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
    try { res.cookies.set(cookieName, String(bal), { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 }) } catch {}
    return res
  } catch (error: any) {
    console.error('Failed to fetch stock prices:', error)
    // Fall back to snapshot if available
    if (snapshot) {
      return respondWithSnapshot(snapshot, 'price_fetch_exception')
    }
    // If no snapshot, return basic data from positions (cost basis as value)
    return respondWithSnapshot(null, 'price_fetch_exception_no_snapshot')
  }
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

        if (process.env.NODE_ENV !== 'production') {
          const preBalance = getWalletBalance(userId)
          console.log('[trade] wallet before', preBalance, 'cost', input.price * input.quantity)
        }

        const result = await upsertTrade(userId, input)
        
        // Get fresh snapshot of all holdings and wallet after trade
        const updatedBal = getWalletBalance(userId)
        if (process.env.NODE_ENV !== 'production') {
          console.log('[trade] wallet after', updatedBal)
        }
        const allPositions = listPositions(userId)
        
        // Calculate mark-to-market totals using live prices
        const { calculateMarkToMarket, savePortfolioSnapshot } = await import('@/lib/portfolio-mark-to-market')
        let mtm
        try {
          mtm = await calculateMarkToMarket(allPositions, updatedBal, false) // R3A: wallet excluded
          // Save snapshot asynchronously
          savePortfolioSnapshot(userId, mtm).catch(err => {
            console.error('Error saving portfolio snapshot after trade:', err)
          })
        } catch (error) {
          console.error('Mark-to-market calculation failed after trade:', error)
          // Fallback to basic calculation
          const totalCost = allPositions.reduce((sum, p) => sum + (p.totalCost || p.avgPrice * p.totalShares || 0), 0)
          mtm = {
            tpv: totalCost, // Fallback: use cost basis if mark-to-market fails
            costBasis: totalCost,
            totalReturn: 0,
            totalReturnPct: 0,
            holdings: allPositions.map(p => ({
              symbol: p.symbol,
              shares: p.totalShares,
              avgPrice: p.avgPrice,
              currentPrice: null,
              marketValue: p.totalCost || p.avgPrice * p.totalShares || 0,
              unrealizedPnl: 0,
              unrealizedPnlPct: 0,
              costBasis: p.totalCost || p.avgPrice * p.totalShares || 0,
            })),
            walletBalance: updatedBal,
            lastUpdated: Date.now(),
          }
        }
        
        // Convert holdings to enriched format
        const enrichedHoldings = mtm.holdings.map(h => ({
          symbol: h.symbol,
          totalShares: h.shares,
          avgPrice: h.avgPrice,
          currentPrice: h.currentPrice,
          totalValue: h.marketValue,
          unrealizedPnl: h.unrealizedPnl,
          unrealizedPnlPct: h.unrealizedPnlPct,
          totalCost: h.costBasis,
          realizedPnl: allPositions.find(p => p.symbol === h.symbol)?.realizedPnl || 0,
        }))
        
        // Return complete fresh snapshot with mark-to-market totals
        const res = NextResponse.json({ 
          // Single item that was traded (for backward compatibility)
          item: result.position, 
          transaction: result.transaction,
          // Complete fresh snapshot with mark-to-market values
          holdings: enrichedHoldings,
          wallet: { balance: updatedBal, cap: 1_000_000 },
          totals: {
            tpv: mtm.tpv,
            costBasis: mtm.costBasis,
            totalReturn: mtm.totalReturn,
            totalReturnPct: mtm.totalReturnPct,
          },
          lastUpdated: mtm.lastUpdated,
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

