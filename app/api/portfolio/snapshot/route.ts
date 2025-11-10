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
    const snapshot = {
      tpv: body.tpv || 0,
      costBasis: body.costBasis || 0,
      totalReturn: body.totalReturn || 0,
      totalReturnPct: body.totalReturnPct || 0,
      holdings: body.holdings || [],
      walletBalance: body.walletBalance || 0,
      lastUpdated: body.lastUpdated || Date.now(),
    }

    await savePortfolioSnapshot(userId, snapshot)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving snapshot:', error)
    return NextResponse.json({ error: error.message || 'Failed to save snapshot' }, { status: 500 })
  }
}

