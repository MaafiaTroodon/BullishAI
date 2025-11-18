import { NextRequest, NextResponse } from 'next/server'
import { getWalletBalance, depositToWallet, withdrawFromWallet, listWalletTransactions, initializeWalletFromBalance, setWalletBalance } from '@/lib/portfolio'
import { getUserId } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  
  // Load portfolio from database first (ensures data persists across logouts)
  const { ensurePortfolioLoaded } = await import('@/lib/portfolio')
  await ensurePortfolioLoaded(userId)
  
  // Get current balance from in-memory store (now loaded from DB)
  // It already accounts for deposits, withdrawals, buys, and sells
  let balance = getWalletBalance(userId)
  const walletTx = listWalletTransactions(userId)
  
  // User-specific cookie name to prevent cross-user data sharing
  const cookieName = `bullish_wallet_${userId}`
  
  // Check if this is a new user (no wallet transactions, no portfolio activity)
  const { listTransactions, listPositions } = await import('@/lib/portfolio')
  const transactions = listTransactions(userId)
  const positions = listPositions(userId)
  const isNewUser = walletTx.length === 0 && transactions.length === 0 && positions.length === 0
  
  // For new users, always start with $0 (don't restore from cookie)
  // Only restore from cookie if user has existing activity (legacy support)
  if (!isNewUser && balance === 0 && walletTx.length === 0) {
    try {
      const cookieBal = req.cookies.get(cookieName)?.value
      if (cookieBal) {
        const parsed = Number(cookieBal)
        if (!Number.isNaN(parsed) && parsed >= 0) {
          // Only restore from cookie if DB balance is 0 (migration scenario)
          balance = parsed
          initializeWalletFromBalance(userId, parsed)
        }
      }
    } catch {}
  } else if (isNewUser) {
    // New user: ensure balance is 0
    balance = 0
  }
  
  // Ensure balance is never negative
  balance = Math.max(0, balance)
  
  const res = NextResponse.json({ balance, cap: 1_000_000, transactions: walletTx })
  // Always persist current balance to user-specific cookie
  try { res.cookies.set(cookieName, String(balance), { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 }) } catch {}
  return res
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const { action, amount } = body || {}
    
    // User-specific cookie name to prevent cross-user data sharing
    const cookieName = `bullish_wallet_${userId}`
    
    // Ensure wallet is initialized from user-specific cookie before processing
    try {
      const cookieBal = req.cookies.get(cookieName)?.value
      if (cookieBal) {
        const parsed = Number(cookieBal)
        if (!Number.isNaN(parsed) && parsed > 0) {
          initializeWalletFromBalance(userId, parsed)
        }
      }
    } catch {}
    
    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'invalid_amount', message: 'Amount must be a positive number' }, { status: 400 })
    }
    
    // Validate decimal places (max 2)
    const roundedAmount = Math.round(amount * 100) / 100
    if (Math.abs(amount - roundedAmount) > 0.001) {
      return NextResponse.json({ error: 'amount_too_many_decimals', message: 'Amount cannot have more than 2 decimal places' }, { status: 400 })
    }
    
    // Validate cap
    const currentBalance = getWalletBalance(userId)
    if (action === 'deposit' && (currentBalance + roundedAmount) > 1_000_000) {
      return NextResponse.json({ error: 'amount_exceeds_cap', message: `Deposit would exceed wallet cap of $1,000,000. Current balance: $${currentBalance.toFixed(2)}` }, { status: 400 })
    }
    
    const method = body.method || 'Manual'
    const idempotencyKey = body.idempotencyKey // Optional idempotency key
    
    if (action === 'deposit') {
      const result = await depositToWallet(userId, roundedAmount, method, idempotencyKey)
      
      // Create snapshot after wallet change
      const { listPositions } = await import('@/lib/portfolio')
      const { calculateMarkToMarket, savePortfolioSnapshot } = await import('@/lib/portfolio-mark-to-market')
      const positions = listPositions(userId)
      if (positions.length > 0) {
        calculateMarkToMarket(positions, result.balance, false)
          .then(mtm => savePortfolioSnapshot(userId, mtm))
          .catch(err => console.error('Error saving snapshot after deposit:', err))
      }
      
      const res = NextResponse.json({ 
        balance: result.balance, 
        transaction: result.transaction 
      })
      try { res.cookies.set(cookieName, String(result.balance), { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 }) } catch {}
      return res
    }
    if (action === 'withdraw') {
      const result = await withdrawFromWallet(userId, roundedAmount, method, idempotencyKey)
      
      // Create snapshot after wallet change
      const { listPositions } = await import('@/lib/portfolio')
      const { calculateMarkToMarket, savePortfolioSnapshot } = await import('@/lib/portfolio-mark-to-market')
      const positions = listPositions(userId)
      if (positions.length > 0) {
        calculateMarkToMarket(positions, result.balance, false)
          .then(mtm => savePortfolioSnapshot(userId, mtm))
          .catch(err => console.error('Error saving snapshot after withdraw:', err))
      }
      
      const res = NextResponse.json({ 
        balance: result.balance, 
        transaction: result.transaction 
      })
      try { res.cookies.set(cookieName, String(result.balance), { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 }) } catch {}
      return res
    }
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'wallet_error' }, { status: 400 })
  }
}


