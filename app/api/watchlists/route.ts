import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  userId: z.string(), // TODO: Get from session
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      )
    }

    const watchlists = await db.watchlist.findMany({
      where: { userId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ watchlists })
  } catch (error: any) {
    console.error('Watchlists GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = createSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid data' },
        { status: 400 }
      )
    }

    const watchlist = await db.watchlist.create({
      data: {
        name: validation.data.name,
        userId: validation.data.userId,
      },
      include: {
        items: true,
      },
    })

    return NextResponse.json({ watchlist }, { status: 201 })
  } catch (error: any) {
    console.error('Watchlists POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

