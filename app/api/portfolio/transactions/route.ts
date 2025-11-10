import { NextRequest, NextResponse } from 'next/server'
import { listTransactions } from '@/lib/portfolio'
import { getUserId } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/portfolio/transactions
 * Get all trade transactions (buys/sells)
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const transactions = listTransactions(userId)
    
    return NextResponse.json({
      transactions: transactions.map(t => ({
        ...t,
        fees: t.fees ?? 0 // Ensure fees field exists, default to 0
      }))
    })
  } catch (error: any) {
    console.error('Portfolio transactions API error:', error)
    return NextResponse.json(
      { error: error.message || 'portfolio_transactions_error', transactions: [] },
      { status: 500 }
    )
  }
}

