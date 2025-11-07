import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/earnings
 * Fetch earnings calendar from Finnhub (primary) or fallback providers
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const range = url.searchParams.get('range') || 'week'
    
    // Determine date range
    const now = new Date()
    const startDate = new Date(now)
    if (range === 'today') {
      startDate.setHours(0, 0, 0, 0)
    } else if (range === 'week') {
      startDate.setDate(startDate.getDate() - 7)
    } else {
      startDate.setMonth(startDate.getMonth() - 1)
    }
    
    const from = startDate.toISOString().split('T')[0]
    const to = now.toISOString().split('T')[0]

    // Try Finnhub first
    let items: any[] = []
    try {
      const finnhubKey = process.env.FINNHUB_API_KEY
      if (finnhubKey) {
        const finnhubUrl = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${finnhubKey}`
        const res = await fetch(finnhubUrl, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data.earningsCalendar && Array.isArray(data.earningsCalendar)) {
            items = data.earningsCalendar.map((e: any) => ({
              symbol: e.symbol,
              company: e.name,
              date: e.date,
              estimate: e.epsEstimate,
              actual: e.epsActual,
              revenueEstimate: e.revenueEstimate,
              revenueActual: e.revenueActual
            }))
          }
        }
      }
    } catch (err) {
      console.error('Finnhub earnings error:', err)
    }

    return NextResponse.json({
      type: 'earnings',
      range,
      items: items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      count: items.length
    })
  } catch (error: any) {
    console.error('Earnings calendar API error:', error)
    return NextResponse.json(
      { error: error.message || 'earnings_calendar_error', items: [], count: 0 },
      { status: 500 }
    )
  }
}

