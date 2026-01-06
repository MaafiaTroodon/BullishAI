import { NextRequest, NextResponse } from 'next/server'
import { getQuoteWithFallback } from '@/lib/providers/market-data'

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
    } else if (range === 'quarter') {
      endDate.setDate(endDate.getDate() + 90)
    } else {
      endDate.setDate(endDate.getDate() + 30)
    }
    
    const from = startDate.toISOString().split('T')[0]
    const to = endDate.toISOString().split('T')[0]

    let items: any[] = []

    const fetchFmp = async (fromDate: string, toDate: string) => {
      const fmpKey = process.env.FMP_API_KEY || '7ZC4HQjy7ZNbndRY1i15fAaGVqF3NHpx'
      if (!fmpKey) return []
      const fmpUrl = `https://financialmodelingprep.com/stable/dividends-calendar?from=${fromDate}&to=${toDate}&apikey=${fmpKey}`
      const res = await fetch(fmpUrl, { cache: 'no-store' })
      if (!res.ok) return []
      const data = await res.json()
      if (!Array.isArray(data)) return []
      return data.map((d: any) => ({
        symbol: d.symbol,
        company: d.symbol,
        date: d.date,
        exDate: d.date,
        recordDate: d.recordDate || null,
        payDate: d.paymentDate || null,
        declarationDate: d.declarationDate || null,
        amount: d.dividend ?? d.adjDividend ?? null,
        yield: d.yield ?? null,
        currency: null,
        frequency: d.frequency || null,
        type: null
      }))
    }

    const fetchFinnhub = async (fromDate: string, toDate: string) => {
      const finnhubKey = process.env.FINNHUB_API_KEY
      if (!finnhubKey) return []
      const finnhubUrl = `https://finnhub.io/api/v1/calendar/dividend?from=${fromDate}&to=${toDate}&token=${finnhubKey}`
      const res = await fetch(finnhubUrl, { cache: 'no-store' })
      if (!res.ok) return []
      const data = await res.json()
      if (!data.dividendCalendar || !Array.isArray(data.dividendCalendar)) return []
      return data.dividendCalendar.map((d: any) => ({
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

    try {
      items = await fetchFmp(from, to)
    } catch (err) {
      console.error('FMP dividends error:', err)
    }
    if (items.length === 0) {
      try {
        items = await fetchFinnhub(from, to)
      } catch (err) {
        console.error('Finnhub dividends error:', err)
      }
    }

    const fetchMassive = async (fromDate: string, toDate: string) => {
      const polygonKey = process.env.POLYGON_API_KEY || 'EITKB2FpN6B8MKdYBnzo_m0ve3HMDFB1'
      const polygonUrl = `https://api.massive.com/v3/reference/dividends?ex_dividend_date.gte=${fromDate}&ex_dividend_date.lte=${toDate}&order=asc&sort=ex_dividend_date&limit=1000&apiKey=${polygonKey}`
      const res = await fetch(polygonUrl, { cache: 'no-store' })
      if (!res.ok) return []
      const data = await res.json()
      if (!data.results || !Array.isArray(data.results) || data.results.length === 0) return []
      return data.results.map((d: any) => ({
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
    }

    // 2. Fallback to Massive.com (formerly Polygon.io) if no items from Finnhub
    if (items.length === 0) {
      try {
        items = await fetchMassive(from, to)
        if (items.length > 0) {
          console.log(`Massive.com dividends: Found ${items.length} items`)
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

    const fetchEodhd = async (fromDate: string, toDate: string) => {
      const eodhdKey = process.env.EODHD_API_KEY
      if (!eodhdKey) return []
      const eodhdUrl = `https://eodhd.com/api/calendar/dividends?from=${fromDate}&to=${toDate}&api_token=${eodhdKey}&fmt=json`
      const res = await fetch(eodhdUrl, { cache: 'no-store' })
      if (!res.ok) return []
      const data = await res.json()
      if (Array.isArray(data)) {
        return data.map((d: any) => ({
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
      if (data.dividends && Array.isArray(data.dividends)) {
        return data.dividends.map((d: any) => ({
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
      return []
    }

    // 4. Last fallback to EODHD if still no items
    if (items.length === 0) {
      try {
        items = await fetchEodhd(from, to)
      } catch (err) {
        console.error('EODHD dividends error:', err)
      }
    }

    if (items.length === 0 && range === 'week') {
      const fallbackEnd = new Date(now)
      fallbackEnd.setDate(fallbackEnd.getDate() + 90)
      const fallbackTo = fallbackEnd.toISOString().split('T')[0]
      try {
        items = await fetchFmp(from, fallbackTo)
      } catch (err) {
        console.error('FMP dividends fallback error:', err)
      }
      if (items.length === 0) {
        try {
          items = await fetchFinnhub(from, fallbackTo)
        } catch (err: any) {
          console.error('Finnhub dividends fallback error:', err.message)
        }
      }
      if (items.length === 0) {
        try {
          items = await fetchMassive(from, fallbackTo)
        } catch (err) {
          console.error('Massive.com dividends fallback error:', err)
        }
      }
      if (items.length === 0) {
        try {
          items = await fetchEodhd(from, fallbackTo)
        } catch (err) {
          console.error('EODHD dividends fallback error:', err)
        }
      }
    }

    if (items.length === 0) {
      console.log('No dividends data from any provider, returning empty array')
    }

    const filteredItems = symbolsFilter
      ? items.filter((item) => symbolsFilter.has(String(item.symbol || '').toUpperCase()))
      : items

    const freqToMultiplier = (frequency?: string) => {
      const value = (frequency || '').toLowerCase()
      if (value.includes('quarter')) return 4
      if (value.includes('semi')) return 2
      if (value.includes('month')) return 12
      if (value.includes('week')) return 52
      if (value.includes('annual')) return 1
      return null
    }

    if (filteredItems.length > 0) {
      const symbolsNeedingYield = Array.from(
        new Set(
          filteredItems
            .filter((item) => {
              const y = Number(item.yield || 0)
              return !(Number.isFinite(y) && y > 0) && item.amount
            })
            .map((item) => String(item.symbol || '').toUpperCase())
            .filter(Boolean)
        )
      )
      const cappedSymbols = symbolsFilter ? symbolsNeedingYield : symbolsNeedingYield.slice(0, 200)

      const priceMap = new Map<string, number>()
      await Promise.allSettled(
        cappedSymbols.map(async (symbol) => {
          try {
            const quote = await getQuoteWithFallback(symbol)
            if (quote?.price && Number.isFinite(quote.price)) {
              priceMap.set(symbol, quote.price)
            }
          } catch {
            // ignore quote failures
          }
        })
      )

      filteredItems.forEach((item: any) => {
        const y = Number(item.yield || 0)
        if (Number.isFinite(y) && y > 0) return
        const symbol = String(item.symbol || '').toUpperCase()
        const price = priceMap.get(symbol)
        const amount = item.amount ? Number(item.amount) : null
        const multiplier = freqToMultiplier(item.frequency)
        if (price && amount && multiplier) {
          const computed = (amount * multiplier * 100) / price
          if (Number.isFinite(computed) && computed > 0) {
            item.yield = computed
            item.yieldEstimated = true
          }
        }
      })
    }

    return NextResponse.json({
      type: 'dividends',
      range,
      items: filteredItems.sort((a, b) => new Date(a.date || a.exDate).getTime() - new Date(b.date || b.exDate).getTime()),
      count: filteredItems.length
    })
  } catch (error: any) {
    console.error('Dividends calendar API error:', error)
    return NextResponse.json(
      { error: error.message || 'dividends_calendar_error', items: [], count: 0 }
    )
  }
}
