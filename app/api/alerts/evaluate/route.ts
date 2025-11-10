import { NextRequest, NextResponse } from 'next/server'
import { listAlerts, updateAlert } from '@/lib/alerts/types'
import { getUserId } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getQuote(symbol: string) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/quote?symbol=${encodeURIComponent(symbol)}`, { cache: 'no-store' })
  const j = await r.json()
  return j?.data || j
}

export async function POST() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const alerts = listAlerts(userId).filter(a => a.active)
  const results: any[] = []
  for (const a of alerts) {
    try {
      const q = await getQuote(a.symbol)
      const price = q?.price
      const changePct = q?.dp
      const volume = q?.volume
      let triggered = false
      if (price != null) {
        if (a.type === 'price_above' && price >= a.value) triggered = true
        if (a.type === 'price_below' && price <= a.value) triggered = true
      }
      if (changePct != null) {
        if (a.type === 'percent_up' && changePct >= a.value) triggered = true
        if (a.type === 'percent_down' && changePct <= -Math.abs(a.value)) triggered = true
      }
      if (volume != null) {
        if (a.type === 'volume_above' && volume >= a.value) triggered = true
      }
      if (triggered) {
        updateAlert(userId, a.id, { active: false })
        results.push({ id: a.id, symbol: a.symbol, type: a.type, triggered: true, price, changePct, volume })
      }
    } catch {}
  }
  return NextResponse.json({ triggered: results })
}


