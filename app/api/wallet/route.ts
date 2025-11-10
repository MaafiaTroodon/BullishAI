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
  
  // Get current balance from in-memory store (this is the source of truth)
  // It already accounts for deposits, withdrawals, buys, and sells
  let balance = getWalletBalance(userId)
  const walletTx = listWalletTransactions(userId)
  
  // If we don't have a balance in memory, try to restore from cookie
  // This handles the case where the server restarts but cookies persist
  if (balance === 0 && walletTx.length === 0) {
    try {
      const cookieBal = req.cookies.get('bullish_wallet')?.value
      if (cookieBal) {
        const parsed = Number(cookieBal)
        if (!Number.isNaN(parsed) && parsed >= 0) {
          balance = parsed
          initializeWalletFromBalance(userId, parsed)
        }
      }
    } catch {}
  }
  
  // Ensure balance is never negative
  balance = Math.max(0, balance)
  
  const res = NextResponse.json({ balance, cap: 1_000_000, transactions: walletTx })
  // Always persist current balance to cookie
  try { res.cookies.set('bullish_wallet', String(balance), { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 }) } catch {}
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
    
    // Ensure wallet is initialized from cookie before processing
    try {
      const cookieBal = req.cookies.get('bullish_wallet')?.value
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
      const result = depositToWallet(userId, roundedAmount, method, idempotencyKey)
      const res = NextResponse.json({ 
        balance: result.balance, 
        transaction: result.transaction 
      })
      try { res.cookies.set('bullish_wallet', String(result.balance), { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 }) } catch {}
      return res
    }
    if (action === 'withdraw') {
      const result = withdrawFromWallet(userId, roundedAmount, method, idempotencyKey)
      const res = NextResponse.json({ 
        balance: result.balance, 
        transaction: result.transaction 
      })
      try { res.cookies.set('bullish_wallet', String(result.balance), { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 }) } catch {}
      return res
    }
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'wallet_error' }, { status: 400 })
  }
}


