import { NextRequest, NextResponse } from 'next/server'
import { TradeInputSchema, listPositions, upsertTrade } from '@/lib/portfolio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUserId() { return 'demo-user' }

export async function GET() {
  const userId = getUserId()
  return NextResponse.json({ items: listPositions(userId) })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = TradeInputSchema.parse(body)
    const userId = getUserId()
    const pos = upsertTrade(userId, input)
    return NextResponse.json({ item: pos })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'invalid_trade' }, { status: 400 })
  }
}


