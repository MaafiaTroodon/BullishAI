import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { AlertSchema, CreateAlertSchema, createAlert, listAlerts } from '@/lib/alerts/types'
import { getUserId } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const data = listAlerts(userId)
  return NextResponse.json({ items: data })
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const parsed = CreateAlertSchema.parse(body)
    const alert = createAlert(userId, parsed)
    return NextResponse.json({ item: alert })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'invalid_payload' }, { status: 400 })
  }
}


