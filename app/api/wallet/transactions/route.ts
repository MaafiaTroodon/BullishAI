import { NextRequest, NextResponse } from 'next/server'
import { listWalletTransactions, getWalletBalance } from '@/lib/portfolio'
import { getUserId } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/wallet/transactions
 * Get all wallet transactions (deposits/withdrawals) with running balance
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Ensure in-memory store is hydrated from DB for accurate balances
    const { ensurePortfolioLoaded, refreshPortfolioFromDB } = await import('@/lib/portfolio')
    const url = new URL(req.url)
    const forceFresh = url.searchParams.get('fresh') === '1'
    if (forceFresh) {
      await refreshPortfolioFromDB(userId)
    } else {
      await ensurePortfolioLoaded(userId)
    }
    
    // User-specific cookie name to prevent cross-user data sharing
    const cookieName = `bullish_wallet_${userId}`
    
    // Try to restore wallet from user-specific cookie if in-memory is empty
    let balance = getWalletBalance(userId)
    try {
      const cookieBal = req.cookies.get(cookieName)?.value
      if (cookieBal) {
        const parsed = Number(cookieBal)
        if (!Number.isNaN(parsed) && parsed >= 0) {
          const { initializeWalletFromBalance } = await import('@/lib/portfolio')
          initializeWalletFromBalance(userId, parsed)
          balance = parsed
        }
      }
    } catch {}
    
    // Get wallet transactions
    let transactions = listWalletTransactions(userId)
    
    // If no transactions but we have a balance, try to sync from client localStorage
    // This is a fallback - normally client should sync on mount
    if (transactions.length === 0 && balance > 0) {
      // Don't try to sync here - let the client handle it
      // Just return empty array - client will sync and refetch
    }
    
    const currentBalance = getWalletBalance(userId) || balance
    
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
    
    // Sort by newest first for display
    transactionsWithBalance.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
    
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
