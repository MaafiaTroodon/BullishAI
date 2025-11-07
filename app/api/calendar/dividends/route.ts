import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/dividends
 * Fetch dividends calendar from multiple sources:
 * 1. Finnhub (primary)
 * 2. Polygon.io (fallback)
 * 3. Yahoo Finance (fallback)
 * 4. EODHD (last fallback)
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

    let items: any[] = []

    // 1. Try Finnhub first
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
        }
      }
    } catch (err) {
      console.error('Finnhub dividends error:', err)
    }

    // 2. Fallback to Polygon.io if no items from Finnhub
    if (items.length === 0) {
      try {
        const polygonKey = process.env.POLYGON_API_KEY || 'EITKB2FpN6B8MKdYBnzo_m0ve3HMDFB1'
        const polygonUrl = `https://api.polygon.io/v3/reference/dividends?ex_dividend_date.gte=${from}&ex_dividend_date.lte=${to}&order=ex_dividend_date&sort=asc&limit=1000&apiKey=${polygonKey}`
        const res = await fetch(polygonUrl, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data.results && Array.isArray(data.results) && data.results.length > 0) {
            items = data.results.map((d: any) => ({
              symbol: d.ticker,
              company: d.name || d.ticker,
              date: d.ex_dividend_date || d.pay_date || d.record_date,
              exDate: d.ex_dividend_date,
              amount: d.cash_amount,
              yield: d.yield ? (d.yield * 100).toFixed(2) : null
            }))
            console.log(`Polygon.io dividends: Found ${items.length} items`)
          }
        } else {
          const errorText = await res.text()
          console.warn(`Polygon.io dividends API returned status ${res.status}:`, errorText.substring(0, 200))
        }
      } catch (err: any) {
        console.error('Polygon.io dividends error:', err.message)
      }
    }

    // 3. Fallback to Yahoo Finance if still no items (try fetching dividend history for popular stocks)
    if (items.length === 0) {
      try {
        // Yahoo Finance dividend calendar is not directly available via API
        // We could fetch dividend data per symbol, but that's inefficient for calendar view
        // Skip Yahoo Finance for now as it requires per-symbol queries
      } catch (err) {
        console.error('Yahoo Finance dividends error:', err)
      }
    }

    // 4. Last fallback to EODHD if still no items
    if (items.length === 0) {
      try {
        const eodhdKey = process.env.EODHD_API_KEY
        if (eodhdKey) {
          // EODHD dividend calendar endpoint
          const eodhdUrl = `https://eodhd.com/api/calendar/dividends?from=${from}&to=${to}&api_token=${eodhdKey}&fmt=json`
          const res = await fetch(eodhdUrl, { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data)) {
              items = data.map((d: any) => ({
                symbol: d.code?.split('.')[0] || d.symbol,
                company: d.name || d.code?.split('.')[0],
                date: d.date || d.exDate,
                exDate: d.exDate || d.date,
                amount: d.amount || d.value,
                yield: d.yield
              }))
            } else if (data.dividends && Array.isArray(data.dividends)) {
              items = data.dividends.map((d: any) => ({
                symbol: d.code?.split('.')[0] || d.symbol,
                company: d.name || d.code?.split('.')[0],
                date: d.date || d.exDate,
                exDate: d.exDate || d.date,
                amount: d.amount || d.value,
                yield: d.yield
              }))
            }
          }
        }
      } catch (err) {
        console.error('EODHD dividends error:', err)
      }
    }

    if (items.length === 0) {
      console.log('No dividends data from any provider, returning empty array')
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

