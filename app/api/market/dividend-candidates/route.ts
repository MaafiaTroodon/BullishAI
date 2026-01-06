import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const symbols = url.searchParams.get('symbols')
    if (!symbols) {
      return NextResponse.json({ items: [], error: 'symbols_required' }, { status: 400 })
    }

    const baseUrl = req.nextUrl.origin
    const res = await fetch(
      `${baseUrl}/api/calendar/dividends?range=month&symbols=${encodeURIComponent(symbols)}`,
      { cache: 'no-store' }
    )

    if (!res.ok) {
      return NextResponse.json({ items: [], error: 'dividends_unavailable' }, { status: res.status })
    }

    const data = await res.json()
    const items = Array.isArray(data.items) ? data.items : []
    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Dividend candidates API error:', error)
    return NextResponse.json({ items: [], error: error.message || 'dividend_candidates_error' }, { status: 500 })
  }
}
