/**
 * API endpoint to save portfolio snapshot
 * Server-side only (avoids pg import in client components)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth-server'
import { savePortfolioSnapshot } from '@/lib/portfolio-mark-to-market'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    
    // CRITICAL: Don't save snapshots with tpv=0 if we have costBasis (invalid data)
    // Only save if tpv > 0 OR if tpv=0 but costBasis is also 0 (empty portfolio)
    const tpv = parseFloat(body.tpv) || 0
    const costBasis = parseFloat(body.costBasis) || 0
    
    // Skip saving if tpv=0 but costBasis>0 (invalid snapshot - prices not loaded yet)
    if (tpv === 0 && costBasis > 0) {
      console.warn(`[Snapshot] Skipping save: tpv=0 but costBasis=$${costBasis.toLocaleString()} (prices not loaded)`)
      return NextResponse.json({ success: false, reason: 'tpv_zero_with_cost_basis' })
    }
    
    const snapshot = {
      tpv,
      costBasis,
      totalReturn: parseFloat(body.totalReturn) || 0,
      totalReturnPct: parseFloat(body.totalReturnPct) || 0,
      holdings: body.holdings || [],
      walletBalance: parseFloat(body.walletBalance) || 0,
      lastUpdated: body.lastUpdated || Date.now(),
    }

    await savePortfolioSnapshot(userId, snapshot)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving snapshot:', error)
    return NextResponse.json({ error: error.message || 'Failed to save snapshot' }, { status: 500 })
  }
}

