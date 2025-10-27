import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const addItemSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const items = await db.watchlistItem.findMany({
      where: { watchlistId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Items GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validation = addItemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid symbol' },
        { status: 400 }
      )
    }

    // Check if item already exists
    const existing = await db.watchlistItem.findFirst({
      where: {
        watchlistId: id,
        symbol: validation.data.symbol,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Symbol already in watchlist' },
        { status: 409 }
      )
    }

    const item = await db.watchlistItem.create({
      data: {
        symbol: validation.data.symbol,
        watchlistId: id,
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error: any) {
    console.error('Items POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

