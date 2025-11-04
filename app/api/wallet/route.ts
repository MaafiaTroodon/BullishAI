import { NextRequest, NextResponse } from 'next/server'
import { getWalletBalance, depositToWallet, withdrawFromWallet, listWalletTransactions, initializeWalletFromBalance } from '@/lib/portfolio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUserId() { return 'demo-user' }

export async function GET(req: NextRequest) {
  const userId = getUserId()
  
  // Restore from cookie if in-memory is empty
  let balance = getWalletBalance(userId)
  const walletTx = listWalletTransactions(userId)
  
  // If we have wallet transactions, recalculate balance from them (more accurate)
  if (walletTx && walletTx.length > 0) {
    let calculatedBalance = 0
    for (const tx of walletTx) {
      if (tx.action === 'deposit') calculatedBalance += tx.amount
      else if (tx.action === 'withdraw') calculatedBalance -= tx.amount
    }
    balance = Math.max(0, calculatedBalance)
  } else {
    // No transactions, try to restore from cookie
    try {
      const cookieBal = req.cookies.get('bullish_wallet')?.value
      if (cookieBal) {
        const parsed = Number(cookieBal)
        if (!Number.isNaN(parsed) && parsed > 0) {
          balance = parsed
          initializeWalletFromBalance(userId, parsed)
        }
      }
    } catch {}
  }
  
  const res = NextResponse.json({ balance, cap: 1_000_000, transactions: walletTx })
  // Always persist current balance to cookie
  try { res.cookies.set('bullish_wallet', String(balance), { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 365 }) } catch {}
  return res
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, amount } = body || {}
    const userId = getUserId()
    if (typeof amount !== 'number' || amount <= 0) return NextResponse.json({ error: 'invalid_amount' }, { status: 400 })
    if (action === 'deposit') {
      const balance = depositToWallet(userId, amount)
      const res = NextResponse.json({ balance })
      try { res.cookies.set('bullish_wallet', String(balance), { path: '/', httpOnly: false }) } catch {}
      return res
    }
    if (action === 'withdraw') {
      const balance = withdrawFromWallet(userId, amount)
      const res = NextResponse.json({ balance })
      try { res.cookies.set('bullish_wallet', String(balance), { path: '/', httpOnly: false }) } catch {}
      return res
    }
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'wallet_error' }, { status: 400 })
  }
}


