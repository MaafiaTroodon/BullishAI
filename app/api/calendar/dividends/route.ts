import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/calendar/dividends
 * Fetch dividends calendar from multiple sources:
 * 1. Finnhub (primary)
 * 2. Massive.com (formerly Polygon.io) (fallback)
 * 3. Yahoo Finance (fallback)
 * 4. EODHD (last fallback)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const range = url.searchParams.get('range') || 'week'
    const symbolsParam = url.searchParams.get('symbols')
    const symbolsFilter = symbolsParam
      ? new Set(
          symbolsParam
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
        )
      : null
    
    // Determine date range
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
              recordDate: d.recordDate || d.record_date,
              payDate: d.payDate || d.pay_date,
              declarationDate: d.declaredDate || d.declarationDate || d.declaration_date,
              amount: d.amount,
              yield: d.yield,
              currency: d.currency,
              frequency: d.frequency,
              type: d.dividendType || d.dividend_type
            }))
          }
        }
      }
    } catch (err) {
      console.error('Finnhub dividends error:', err)
    }

    // 2. Fallback to Massive.com (formerly Polygon.io) if no items from Finnhub
    if (items.length === 0) {
      try {
        const polygonKey = process.env.POLYGON_API_KEY || 'EITKB2FpN6B8MKdYBnzo_m0ve3HMDFB1'
        // Use Massive.com API (Polygon.io migrated to Massive.com)
        // order=asc (direction), sort=ex_dividend_date (field to sort by)
        const polygonUrl = `https://api.massive.com/v3/reference/dividends?ex_dividend_date.gte=${from}&ex_dividend_date.lte=${to}&order=asc&sort=ex_dividend_date&limit=1000&apiKey=${polygonKey}`
        const res = await fetch(polygonUrl, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data.results && Array.isArray(data.results) && data.results.length > 0) {
            items = data.results.map((d: any) => ({
              symbol: d.ticker,
              company: d.name || d.ticker,
              date: d.ex_dividend_date || d.pay_date || d.record_date,
              exDate: d.ex_dividend_date,
              recordDate: d.record_date,
              payDate: d.pay_date,
              declarationDate: d.declaration_date,
              amount: d.cash_amount,
              yield: typeof d.yield === 'number' ? Number((d.yield * 100).toFixed(2)) : null,
              currency: d.currency,
              frequency: d.frequency,
              type: d.dividend_type
            }))
            console.log(`Massive.com dividends: Found ${items.length} items`)
          }
        } else {
          const errorText = await res.text()
          console.warn(`Massive.com dividends API returned status ${res.status}:`, errorText.substring(0, 200))
        }
      } catch (err: any) {
        console.error('Massive.com dividends error:', err.message)
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
                recordDate: d.recordDate || d.record_date,
                payDate: d.payDate || d.pay_date,
                declarationDate: d.declaredDate || d.declarationDate || d.declaration_date,
                amount: d.amount || d.value,
                yield: d.yield,
                currency: d.currency,
                frequency: d.frequency,
                type: d.type || d.dividendType || d.dividend_type
              }))
            } else if (data.dividends && Array.isArray(data.dividends)) {
              items = data.dividends.map((d: any) => ({
                symbol: d.code?.split('.')[0] || d.symbol,
                company: d.name || d.code?.split('.')[0],
                date: d.date || d.exDate,
                exDate: d.exDate || d.date,
                recordDate: d.recordDate || d.record_date,
                payDate: d.payDate || d.pay_date,
                declarationDate: d.declaredDate || d.declarationDate || d.declaration_date,
                amount: d.amount || d.value,
                yield: d.yield,
                currency: d.currency,
                frequency: d.frequency,
                type: d.type || d.dividendType || d.dividend_type
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

    const filteredItems = symbolsFilter
      ? items.filter((item) => symbolsFilter.has(String(item.symbol || '').toUpperCase()))
      : items

    return NextResponse.json({
      type: 'dividends',
      range,
      items: filteredItems.sort((a, b) => new Date(a.date || a.exDate).getTime() - new Date(b.date || b.exDate).getTime()),
      count: filteredItems.length
    })
  } catch (error: any) {
    console.error('Dividends calendar API error:', error)
    return NextResponse.json(
      { error: error.message || 'dividends_calendar_error', items: [], count: 0 },
      { status: 500 }
    )
  }
}
