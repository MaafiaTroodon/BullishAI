import { NextRequest, NextResponse } from 'next/server'
import { getMultiSourceNews } from '@/lib/news-multi-source'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const newsSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      )
    }

    // Validate input
    const validation = newsSchema.safeParse({ symbol })
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      )
    }

    try {
      const news = await getMultiSourceNews(validation.data.symbol)

      return NextResponse.json({
        symbol: validation.data.symbol,
        items: news,
      })
    } catch (error: any) {
      console.error('News fetch failed:', error.message)
      return NextResponse.json({
        symbol: validation.data.symbol,
        items: [],
      })
    }
  } catch (error: any) {
    console.error('News API error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
