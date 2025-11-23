import { NextRequest, NextResponse } from 'next/server'
import { getAlert, updateAlert, deleteAlert } from '@/lib/alerts/types'
import { getUserId } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const item = await getAlert(userId, id)
    if (!item) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ item })
  } catch (error: any) {
    console.error('Error fetching alert:', error)
    return NextResponse.json({ error: 'Failed to fetch alert' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const updated = await updateAlert(userId, id, body)
    if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ item: updated })
  } catch (error: any) {
    console.error('Error updating alert:', error)
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const ok = await deleteAlert(userId, id)
    if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Error deleting alert:', error)
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 })
  }
}


