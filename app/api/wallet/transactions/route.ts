import { NextRequest, NextResponse } from 'next/server'
import { listWalletTransactions, getWalletBalance } from '@/lib/portfolio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUserId() { return 'demo-user' }

/**
 * GET /api/wallet/transactions
 * Get all wallet transactions (deposits/withdrawals) with running balance
 */
export async function GET(req: NextRequest) {
  try {
    const userId = getUserId()
    const transactions = listWalletTransactions(userId)
    const currentBalance = getWalletBalance(userId)
    
    // Sort chronologically (oldest first) for running balance calculation
    const sorted = [...transactions].sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0))
    
    // Calculate running balances forward from start
    let runningBalance = 0
    const transactionsWithBalance = sorted.map((t: any) => {
      if (t.action === 'deposit') {
        runningBalance += t.amount || 0
      } else if (t.action === 'withdraw') {
        runningBalance -= t.amount || 0
      }
      return {
        ...t,
        method: t.method || 'Manual', // Default method
        runningBalance: t.resultingBalance !== undefined ? t.resultingBalance : runningBalance, // Use resultingBalance if available, otherwise calculate
        resultingBalance: t.resultingBalance !== undefined ? t.resultingBalance : runningBalance // Ensure resultingBalance is always present
      }
    })
    
    return NextResponse.json({
      transactions: transactionsWithBalance,
      currentBalance,
      openingBalance: sorted.length > 0 ? (runningBalance - (currentBalance - runningBalance)) : currentBalance
    })
  } catch (error: any) {
    console.error('Wallet transactions API error:', error)
    return NextResponse.json(
      { error: error.message || 'wallet_transactions_error', transactions: [], currentBalance: 0 },
      { status: 500 }
    )
  }
}

