import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Fetch top movers
    const moversRes = await fetch(`${req.nextUrl.origin}/api/market/top-movers?limit=${limit}`)
    const movers = await moversRes.json().catch(() => ({ movers: [] }))

    // Fetch news for each mover
    const items = await Promise.all(
      movers.movers.slice(0, limit).map(async (mover: any) => {
        try {
          const newsRes = await fetch(`${req.nextUrl.origin}/api/news?symbol=${mover.symbol}`)
          const news = await newsRes.json().catch(() => ({ items: [] }))
          return {
            symbol: mover.symbol,
            name: mover.name,
            change: mover.change,
            changePercent: mover.changePercent,
            headline: news.items?.[0]?.headline || 'No recent news',
            summary: news.items?.[0]?.summary || '',
            source: news.items?.[0]?.source || 'Market Data',
            datetime: news.items?.[0]?.datetime || Date.now(),
          }
        } catch {
          return {
            symbol: mover.symbol,
            name: mover.name,
            change: mover.change,
            changePercent: mover.changePercent,
            headline: 'No recent news',
            summary: '',
            source: 'Market Data',
            datetime: Date.now(),
          }
        }
      })
    )

    return NextResponse.json({
      items,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('News movers API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch news movers' },
      { status: 500 }
    )
  }
}

