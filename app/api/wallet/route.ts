import { NextRequest, NextResponse } from 'next/server'
import { getWalletBalance, depositToWallet, withdrawFromWallet, listWalletTransactions } from '@/lib/portfolio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUserId() { return 'demo-user' }

export async function GET(req: NextRequest) {
  const userId = getUserId()
  let balance = getWalletBalance(userId)
  // Also hydrate from cookie if present (persists across deployments)
  try {
    const cookieBal = req.cookies.get('bullish_wallet')?.value
    if (cookieBal) {
      const parsed = Number(cookieBal)
      if (!Number.isNaN(parsed)) balance = Math.max(balance, parsed)
    }
  } catch {}
  const res = NextResponse.json({ balance, cap: 1_000_000, transactions: listWalletTransactions(userId) })
  // Reflect current balance in cookie
  try { res.cookies.set('bullish_wallet', String(balance), { path: '/', httpOnly: false }) } catch {}
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


