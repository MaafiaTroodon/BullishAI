import { NextRequest, NextResponse } from 'next/server'
import { getCompanyNews } from '@/lib/finnhub'
import { z } from 'zod'

const newsSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  limit: z.coerce.number().min(1).max(20).optional().default(5),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')
    const limit = searchParams.get('limit')

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      )
    }

    // Validate input
    const validation = newsSchema.safeParse({ symbol, limit })
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      )
    }

    const news = await getCompanyNews(
      validation.data.symbol,
      validation.data.limit
    )

    // Transform news data to a cleaner format
    const formattedNews = news.map((item: any) => ({
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      image: item.image,
      datetime: item.datetime,
    }))

    return NextResponse.json({
      symbol: validation.data.symbol,
      news: formattedNews,
    })
  } catch (error: any) {
    console.error('News API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

