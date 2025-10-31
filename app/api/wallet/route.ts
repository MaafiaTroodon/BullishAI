import { NextRequest, NextResponse } from 'next/server'
import { getWalletBalance, depositToWallet, withdrawFromWallet } from '@/lib/portfolio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUserId() { return 'demo-user' }

export async function GET() {
  const userId = getUserId()
  const balance = getWalletBalance(userId)
  return NextResponse.json({ balance, cap: 1_000_000 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, amount } = body || {}
    const userId = getUserId()
    if (typeof amount !== 'number' || amount <= 0) return NextResponse.json({ error: 'invalid_amount' }, { status: 400 })
    if (action === 'deposit') {
      const balance = depositToWallet(userId, amount)
      return NextResponse.json({ balance })
    }
    if (action === 'withdraw') {
      const balance = withdrawFromWallet(userId, amount)
      return NextResponse.json({ balance })
    }
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'wallet_error' }, { status: 400 })
  }
}


