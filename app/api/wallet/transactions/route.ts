import { NextRequest, NextResponse } from 'next/server'
import { listWalletTransactions } from '@/lib/portfolio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUserId() { return 'demo-user' }

/**
 * GET /api/wallet/transactions
 * Get all wallet transactions (deposits/withdrawals)
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId()
    const transactions = listWalletTransactions(userId)
    
    return NextResponse.json({
      transactions: transactions.map(t => ({
        ...t,
        method: 'EFT' // Default method
      }))
    })
  } catch (error: any) {
    console.error('Wallet transactions API error:', error)
    return NextResponse.json(
      { error: error.message || 'wallet_transactions_error', transactions: [] },
      { status: 500 }
    )
  }
}

