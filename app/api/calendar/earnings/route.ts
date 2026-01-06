import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/earnings
 * Fetch earnings calendar from multiple sources
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const range = url.searchParams.get('range') || 'week'
    
    // Determine date range (forward-looking)
    const now = new Date()
    const startDate = new Date(now)
    const endDate = new Date(now)
    if (range === 'today') {
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)
    } else if (range === 'week') {
      endDate.setDate(endDate.getDate() + 7)
    } else {
      endDate.setDate(endDate.getDate() + 30)
    }
    
    const from = startDate.toISOString().split('T')[0]
    const to = endDate.toISOString().split('T')[0]

    let items: any[] = []

    // Try Finnhub first
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
              time: e.hour || 'Before Market',
              estimate: e.epsEstimate ? parseFloat(e.epsEstimate) : null,
              actual: e.epsActual ? parseFloat(e.epsActual) : null,
              revenueEstimate: e.revenueEstimate ? parseFloat(e.revenueEstimate) : null,
              revenueActual: e.revenueActual ? parseFloat(e.revenueActual) : null,
            }))
          }
        }
      }
    } catch (err) {
      console.error('Finnhub earnings error:', err)
    }

    // Fallback: use Alpha Vantage if available
    if (items.length === 0) {
      try {
        const avKey = process.env.ALPHAVANTAGE_API_KEY
        if (avKey) {
          // Alpha Vantage doesn't have a direct earnings calendar, so we'll use a fallback
          // In production, you might want to use a different provider
        }
      } catch (err) {
        console.error('Alpha Vantage earnings error:', err)
      }
    }

    // Sort by date
    items.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime()
      const dateB = new Date(b.date || 0).getTime()
      return dateA - dateB
    })

    return NextResponse.json({
      items,
      count: items.length,
      range,
      from,
      to,
    })
  } catch (error: any) {
    console.error('Earnings calendar API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch earnings calendar', items: [] },
      { status: 500 }
    )
  }
}
