import { NextRequest, NextResponse } from 'next/server'
import { searchSymbol } from '@/lib/finnhub'
import { z } from 'zod'

const searchSchema = z.object({
  query: z.string().min(1).max(100),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    // Validate input
    const validation = searchSchema.safeParse({ query })
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query' },
        { status: 400 }
      )
    }

    const results = await searchSymbol(validation.data.query)

    // Transform results to a cleaner format
    const formattedResults = results
      .filter((item: any) => item.type === 'Common Stock')
      .map((item: any) => ({
        symbol: item.symbol,
        name: item.description,
        type: item.type,
      }))
      .slice(0, 10) // Limit to top 10 results

    return NextResponse.json({
      query: validation.data.query,
      results: formattedResults,
    })
  } catch (error: any) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

