import { NextRequest, NextResponse } from 'next/server'
import { getPortfolioSeries, Range } from '@/lib/portfolio-series'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUserId() { return 'demo-user' }

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId()
    const url = new URL(req.url)
    const range = (url.searchParams.get('range') || '1M').toUpperCase() as Range
    
    // Validate range
    const validRanges: Range[] = ['1H', '1D', '3D', '1W', '1M', '3M', '6M', '1Y', 'ALL']
    if (!validRanges.includes(range)) {
      return NextResponse.json({ error: 'invalid_range', series: [] }, { status: 400 })
    }
    
    // Determine base URL
    const protocol = req.headers.get('x-forwarded-proto') || 'http'
    const host = req.headers.get('host') || 'localhost:3000'
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
    
    const series = await getPortfolioSeries(userId, range, baseUrl)
    
    return NextResponse.json({
      range,
      series,
      count: series.length
    })
  } catch (error: any) {
    console.error('Portfolio series API error:', error)
    return NextResponse.json(
      { error: error.message || 'portfolio_series_error', series: [] },
      { status: 500 }
    )
  }
}

