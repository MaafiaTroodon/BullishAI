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
      fetch(`${baseUrl}/api/calendar/dividends?range=month&symbols=${symbols.join(',')}`, { cache: 'no-store' }),
    ])

    const quotesJson = await quotesRes.json().catch(() => ({ quotes: [] }))
    const dividendJson = await dividendsRes.json().catch(() => ({ items: [] }))

    const quoteMap = new Map<string, any>()
    for (const quote of quotesJson.quotes || []) {
      if (quote.symbol) quoteMap.set(String(quote.symbol).toUpperCase(), quote)
    }

    type DividendCalendarItem = {
      symbol?: string
      exDate?: string
      payDate?: string
      date?: string
      amount?: number | string
      yield?: number | string
      frequency?: string
    }

    const dividendItems: DividendCalendarItem[] = Array.isArray(dividendJson.items)
      ? (dividendJson.items as DividendCalendarItem[])
      : []
    const dividendMap = new Map<string, DividendCalendarItem[]>()
    dividendItems.forEach((item: DividendCalendarItem) => {
      const symbol = String(item.symbol || '').toUpperCase()
      if (!symbol) return
      if (!dividendMap.has(symbol)) dividendMap.set(symbol, [])
      dividendMap.get(symbol)?.push(item)
    })

    const candleResults = await Promise.allSettled(
      symbols.map((symbol) =>
        fetch(`${baseUrl}/api/chart?symbol=${symbol}&range=1y`, { cache: 'no-store' })
          .then((res) => res.json())
      )
    )

    const fundamentalsResults = await Promise.allSettled(
      symbols.map((symbol) =>
        fetch(`${baseUrl}/api/stocks/${symbol}`, { cache: 'no-store' })
          .then((res) => res.json())
      )
    )
    const dividendYieldBySymbol = new Map<string, number | null>()
    fundamentalsResults.forEach((result, idx) => {
      const symbol = symbols[idx]
      if (result.status !== 'fulfilled') {
        dividendYieldBySymbol.set(symbol, null)
        return
      }
      const yieldValue = safeNumber(result.value?.dividendYield)
      dividendYieldBySymbol.set(symbol, yieldValue)
    })

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
      const quoteData = quote?.data ?? quote ?? {}
      const price = safeNumber(quoteData?.price ?? quoteData?.c ?? quoteData?.close)
      const high = safeNumber(quoteData?.high)
      const low = safeNumber(quoteData?.low)
      const changePercent = safeNumber(quoteData?.dp ?? quoteData?.changePercent)
      const marketCap = safeNumber(quoteData?.marketCap)
      const exchange = symbol.endsWith('.TO') ? 'TSX' : symbol.includes('.') ? 'OTHER' : 'US'
      const quoteRange = price && high && low ? ((high - low) / price) * 100 : null

      const candles = candlesBySymbol.get(symbol) || []
      const normalizedCandles = candles
        .map((c) => ({
          close: safeNumber(c.c ?? c.close),
          high: safeNumber(c.h ?? c.high),
          low: safeNumber(c.l ?? c.low),
        }))
        .filter((c) => c.close && c.close > 0)
      const closes = normalizedCandles.map((c) => c.close as number)
      const dailyRanges = []
      const dailyReturns = []
      for (let i = 1; i < normalizedCandles.length; i += 1) {
        const prevClose = normalizedCandles[i - 1]?.close
        const currClose = normalizedCandles[i]?.close
        const dayHigh = normalizedCandles[i]?.high
        const dayLow = normalizedCandles[i]?.low
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

      const quarterStep = 63
      const earningsSamples: number[] = []
      for (let idx = closes.length - 1; earningsSamples.length < 4 && idx - quarterStep >= 0; idx -= quarterStep) {
        const prev = closes[idx - quarterStep]
        const curr = closes[idx]
        if (prev && curr) {
          earningsSamples.push(((curr - prev) / prev) * 100)
        }
      }
      const sampleCount = earningsSamples.length
      const lastReaction = earningsSamples.length ? earningsSamples[0] : null
      const sampleAbs = earningsSamples.map((v) => Math.abs(v)).sort((a, b) => a - b)
      const medianMove = sampleAbs.length >= 3 ? sampleAbs[Math.floor(sampleAbs.length / 2)] : null

      let typicalMove = null
      if (medianMove && Number.isFinite(medianMove)) {
        typicalMove = medianMove
      } else if (avgRange && Number.isFinite(avgRange)) {
        typicalMove = avgRange
      } else if (realizedVol && Number.isFinite(realizedVol)) {
        typicalMove = realizedVol * 1.2
      } else if (quoteRange && Number.isFinite(quoteRange)) {
        typicalMove = quoteRange
      } else if (changePercent && Number.isFinite(changePercent)) {
        typicalMove = Math.abs(changePercent)
      }
      if (typicalMove !== null && typicalMove > 30) {
        typicalMove = null
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

      let dividendStatus: 'Pays' | 'No dividend' | 'Unknown' = 'Unknown'
      if (dividendCandidates.length > 0 || (computedYield && computedYield > 0)) {
        dividendStatus = 'Pays'
      } else {
        const fundamentalYield = dividendYieldBySymbol.get(symbol)
        if (fundamentalYield === 0) {
          dividendStatus = 'No dividend'
        } else if (fundamentalYield && fundamentalYield > 0) {
          dividendStatus = 'Pays'
          if (!computedYield) computedYield = fundamentalYield
        }
      }

      const eligible =
        exchange !== 'OTHER' &&
        (exchange === 'TSX' || exchange === 'US') &&
        marketCap !== null &&
        marketCap >= 100_000_000_000 &&
        closes.length >= 200 &&
        sampleCount >= 3 &&
        realizedVol !== null

      items[symbol] = {
        symbol,
        exchange,
        marketCap,
        changePercent,
        price,
        typicalMove,
        realizedVol,
        lastReaction,
        sampleCount,
        rangePercent: quoteRange,
        dataQuality: eligible ? 'ok' : 'limited',
        eligible,
        dividend: {
          status: eligible ? dividendStatus : 'Unknown',
          exDate: eligible ? upcoming?.exDate || null : null,
          payDate: eligible ? upcoming?.payDate || null : null,
          yield: eligible ? computedYield : null,
          yieldEstimated: eligible ? yieldEstimated : false,
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
