import { NextRequest, NextResponse } from 'next/server'
import { getAlert, updateAlert, deleteAlert } from '@/lib/alerts/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUserId() { return 'demo-user' }

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  const item = getAlert(userId, params.id)
  if (!item) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ item })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  const body = await req.json()
  const updated = updateAlert(userId, params.id, body)
  if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ item: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  const ok = deleteAlert(userId, params.id)
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}


