import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params
    const body = await request.json()

    const item = await db.watchlistItem.update({
      where: { id: itemId },
      data: body,
    })

    return NextResponse.json({ item })
  } catch (error: any) {
    console.error('Item PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params
    
    await db.watchlistItem.delete({
      where: { id: itemId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Item DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

