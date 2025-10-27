import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const watchlist = await db.watchlist.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!watchlist) {
      return NextResponse.json(
        { error: 'Watchlist not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ watchlist })
  } catch (error: any) {
    console.error('Watchlist GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const watchlist = await db.watchlist.update({
      where: { id },
      data: {
        name: body.name,
      },
      include: {
        items: true,
      },
    })

    return NextResponse.json({ watchlist })
  } catch (error: any) {
    console.error('Watchlist PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.watchlist.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Watchlist DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

