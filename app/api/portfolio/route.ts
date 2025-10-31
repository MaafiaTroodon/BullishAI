import { NextRequest, NextResponse } from 'next/server'
import { TradeInputSchema, listPositions, upsertTrade, getWalletBalance } from '@/lib/portfolio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUserId() { return 'demo-user' }

export async function GET(req: NextRequest) {
  const userId = getUserId()
  const url = new URL(req.url)
  const enrich = url.searchParams.get('enrich') === '1'
  const includeTransactions = url.searchParams.get('transactions') === '1'
  const items = listPositions(userId)
  
  const bal = getWalletBalance(userId)
  const response: any = { items, wallet: { balance: bal, cap: 1_000_000 } }
  
  // Include transaction history if requested
  if (includeTransactions) {
    const { listTransactions } = await import('@/lib/portfolio')
    response.transactions = listTransactions(userId)
  }
  
  if (!enrich || items.length === 0) {
    const res = NextResponse.json(response)
    try { res.cookies.set('bullish_wallet', String(bal), { path: '/', httpOnly: false }) } catch {}
    return res
  }

  // Enrich with fast concurrent quotes from our own quote endpoint
  const enriched = await Promise.all(items.map(async (p) => {
    try {
      // Determine base URL dynamically
      const protocol = req.headers.get('x-forwarded-proto') || 'http'
      const host = req.headers.get('host') || 'localhost:3000'
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
      
      const r = await fetch(`${baseUrl}/api/quote?symbol=${encodeURIComponent(p.symbol)}`, { 
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!r.ok) {
        throw new Error(`Quote API returned ${r.status}`)
      }
      
      const contentType = r.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Quote API returned non-JSON response')
      }
      
      const j = await r.json()
      const price = j?.data?.price ?? j?.price ?? null
      const totalValue = price ? price * p.totalShares : 0
      const base = (p.totalCost || p.avgPrice * p.totalShares) || 0
      const unreal = price ? (price - p.avgPrice) * p.totalShares : 0
      const unrealPct = base > 0 ? (unreal / base) * 100 : 0
      return { 
        ...p, 
        currentPrice: price, 
        totalValue, 
        unrealizedPnl: unreal, 
        unrealizedPnlPct: unrealPct,
        totalCost: p.totalCost || p.avgPrice * p.totalShares || 0
      }
    } catch (err: any) {
      console.error(`Error enriching position ${p.symbol}:`, err.message)
      return { 
        ...p, 
        currentPrice: null, 
        totalValue: 0, 
        unrealizedPnl: 0, 
        unrealizedPnlPct: 0,
        totalCost: p.totalCost || p.avgPrice * p.totalShares || 0
      }
    }
  }))
  return NextResponse.json({ items: enriched, wallet: { balance: bal, cap: 1_000_000 } }, {
    headers: {
      'Content-Type': 'application/json',
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userId = getUserId()

    // Optional: bulk sync positions snapshot from client localStorage
    if (Array.isArray(body?.syncPositions)) {
      const { PositionSchema, mergePositions } = await import('@/lib/portfolio')
      const validated: any[] = []
      for (const p of body.syncPositions) {
        try { validated.push(PositionSchema.parse(p)) } catch {}
      }
      if (validated.length > 0) {
        mergePositions(userId, validated)
      }
    }

    // Process single trade
    if (body && body.symbol) {
      const input = TradeInputSchema.parse(body)
      try {
        const pos = upsertTrade(userId, input)
        const updatedBal = getWalletBalance(userId)
        const res = NextResponse.json({ item: pos, wallet: { balance: updatedBal, cap: 1_000_000 } })
        try { res.cookies.set('bullish_wallet', String(updatedBal), { path: '/', httpOnly: false }) } catch {}
        return res
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'trade_failed' }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'invalid_trade' }, { status: 400 })
  }
}


