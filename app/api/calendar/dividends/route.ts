import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/dividends
 * Fetch dividends calendar from Finnhub (primary) or fallback providers
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
        const finnhubUrl = `https://finnhub.io/api/v1/calendar/dividend?from=${from}&to=${to}&token=${finnhubKey}`
        const res = await fetch(finnhubUrl, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data.dividendCalendar && Array.isArray(data.dividendCalendar)) {
            items = data.dividendCalendar.map((d: any) => ({
              symbol: d.symbol,
              company: d.name,
              date: d.date,
              exDate: d.exDate,
              amount: d.amount,
              yield: d.yield
            }))
          }
        } else {
          console.warn('Finnhub dividends API returned non-OK status:', res.status)
        }
      } else {
        console.warn('FINNHUB_API_KEY not set')
      }
    } catch (err) {
      console.error('Finnhub dividends error:', err)
    }

    // If no items from Finnhub, try alternative approach or return empty with helpful message
    if (items.length === 0) {
      console.log('No dividends data from Finnhub, returning empty array')
    }

    return NextResponse.json({
      type: 'dividends',
      range,
      items: items.sort((a, b) => new Date(a.date || a.exDate).getTime() - new Date(b.date || b.exDate).getTime()),
      count: items.length
    })
  } catch (error: any) {
    console.error('Dividends calendar API error:', error)
    return NextResponse.json(
      { error: error.message || 'dividends_calendar_error', items: [], count: 0 },
      { status: 500 }
    )
  }
}

