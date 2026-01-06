import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CacheEntry = { ts: number; data: any }

const CACHE_TTL_MS = 60_000
const cache = new Map<string, CacheEntry>()

const freqToMultiplier = (frequency: any) => {
  if (frequency == null) return null
  if (typeof frequency === 'number') return frequency
  const value = String(frequency).toLowerCase()
  if (value.includes('month')) return 12
  if (value.includes('quarter') || value.includes('q')) return 4
  if (value.includes('semi') || value.includes('half')) return 2
  if (value.includes('annual') || value.includes('year')) return 1
  return null
}

const safeNumber = (value: any) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rawSymbols = (searchParams.get('symbols') || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
    const symbols = Array.from(new Set(rawSymbols)).slice(0, 12)
    if (symbols.length === 0) {
      return NextResponse.json({ items: {}, symbols: [] })
    }

    const cacheKey = `earnings-insights:${symbols.join(',')}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.data)
    }

    const baseUrl = req.nextUrl.origin

    const [quotesRes, dividendsRes] = await Promise.all([
      fetch(`${baseUrl}/api/quotes?symbols=${symbols.join(',')}`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/calendar/dividends?range=month`, { cache: 'no-store' }),
    ])

    const quotesJson = await quotesRes.json().catch(() => ({ quotes: [] }))
    const dividendJson = await dividendsRes.json().catch(() => ({ items: [] }))

    const quoteMap = new Map<string, any>()
    for (const quote of quotesJson.quotes || []) {
      if (quote.symbol) quoteMap.set(String(quote.symbol).toUpperCase(), quote)
    }

    const dividendItems = Array.isArray(dividendJson.items) ? dividendJson.items : []
    const dividendMap = new Map<string, any[]>()
    dividendItems.forEach((item) => {
      const symbol = String(item.symbol || '').toUpperCase()
      if (!symbol) return
      if (!dividendMap.has(symbol)) dividendMap.set(symbol, [])
      dividendMap.get(symbol)?.push(item)
    })

    const candleResults = await Promise.allSettled(
      symbols.map((symbol) =>
        fetch(`${baseUrl}/api/chart?symbol=${symbol}&range=1m`, { cache: 'no-store' })
          .then((res) => res.json())
      )
    )

    const candlesBySymbol = new Map<string, any[]>()
    candleResults.forEach((result, idx) => {
      if (result.status !== 'fulfilled') return
      const symbol = symbols[idx]
      const data = result.value?.data || result.value?.candles || []
      if (Array.isArray(data) && data.length > 0) {
        candlesBySymbol.set(symbol, data)
      }
    })

    const items: Record<string, any> = {}

    for (const symbol of symbols) {
      const quote = quoteMap.get(symbol)
      const price = safeNumber(quote?.price ?? quote?.c ?? quote?.close)
      const high = safeNumber(quote?.high)
      const low = safeNumber(quote?.low)
      const changePercent = safeNumber(quote?.dp ?? quote?.changePercent)
      const quoteRange = price && high && low ? ((high - low) / price) * 100 : null

      const candles = candlesBySymbol.get(symbol) || []
      const recentCandles = candles.slice(-6)
      const dailyRanges = []
      const dailyReturns = []
      for (let i = 1; i < recentCandles.length; i += 1) {
        const prev = recentCandles[i - 1]
        const curr = recentCandles[i]
        const prevClose = safeNumber(prev.c ?? prev.close)
        const currClose = safeNumber(curr.c ?? curr.close)
        const dayHigh = safeNumber(curr.h ?? curr.high)
        const dayLow = safeNumber(curr.l ?? curr.low)
        if (currClose && prevClose) {
          dailyReturns.push(((currClose - prevClose) / prevClose) * 100)
        }
        if (dayHigh && dayLow && currClose) {
          dailyRanges.push(((dayHigh - dayLow) / currClose) * 100)
        }
      }
      const realizedVol = dailyReturns.length
        ? dailyReturns.reduce((sum, v) => sum + Math.abs(v), 0) / dailyReturns.length
        : null
      const avgRange = dailyRanges.length
        ? dailyRanges.reduce((sum, v) => sum + v, 0) / dailyRanges.length
        : null
      const lastReaction = dailyReturns.length ? dailyReturns[dailyReturns.length - 1] : null

      let typicalMove = null
      if (avgRange && Number.isFinite(avgRange)) {
        typicalMove = avgRange
      } else if (realizedVol && Number.isFinite(realizedVol)) {
        typicalMove = realizedVol * 1.2
      } else if (quoteRange && Number.isFinite(quoteRange)) {
        typicalMove = quoteRange
      } else if (changePercent && Number.isFinite(changePercent)) {
        typicalMove = Math.abs(changePercent)
      }

      const dividendCandidates = (dividendMap.get(symbol) || []).sort((a, b) => {
        const dateA = new Date(a.payDate || a.exDate || a.date || 0).getTime()
        const dateB = new Date(b.payDate || b.exDate || b.date || 0).getTime()
        return dateA - dateB
      })
      const upcoming = dividendCandidates.find((d) => {
        const date = new Date(d.payDate || d.exDate || d.date || 0).getTime()
        return Number.isFinite(date) && date >= Date.now() - 86400000
      })
      const dividendAmount = safeNumber(upcoming?.amount)
      const dividendYield = safeNumber(upcoming?.yield)
      const multiplier = freqToMultiplier(upcoming?.frequency)
      let computedYield = null
      let yieldEstimated = false
      if (dividendYield && dividendYield > 0) {
        computedYield = dividendYield
      } else if (dividendAmount && price && multiplier) {
        computedYield = (dividendAmount * multiplier * 100) / price
        yieldEstimated = true
      }

      const dividendStatus = dividendCandidates.length > 0 || computedYield
        ? 'Pays'
        : 'Unknown'

      items[symbol] = {
        symbol,
        changePercent,
        price,
        typicalMove,
        realizedVol,
        lastReaction,
        rangePercent: quoteRange,
        dataQuality: typicalMove ? 'ok' : 'limited',
        dividend: {
          status: dividendStatus,
          exDate: upcoming?.exDate || null,
          payDate: upcoming?.payDate || null,
          yield: computedYield,
          yieldEstimated,
        },
      }
    }

    const payload = { symbols, items }
    cache.set(cacheKey, { ts: Date.now(), data: payload })
    return NextResponse.json(payload)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'earnings_insights_error', items: {}, symbols: [] },
      { status: 500 }
    )
  }
}
