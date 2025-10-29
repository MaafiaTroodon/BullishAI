import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { AlertSchema, CreateAlertSchema, createAlert, listAlerts } from '@/lib/alerts/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// In a real app, derive userId from auth session. For now, single-user stub.
function getUserId() { return 'demo-user' }

export async function GET() {
  const userId = getUserId()
  const data = listAlerts(userId)
  return NextResponse.json({ items: data })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = CreateAlertSchema.parse(body)
    const userId = getUserId()
    const alert = createAlert(userId, parsed)
    return NextResponse.json({ item: alert })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'invalid_payload' }, { status: 400 })
  }
}


