import { NextRequest, NextResponse } from 'next/server'
import { parseSymbol } from '@/lib/market-symbol-parser'
import { TOP_US_UNIVERSE, TOP_CANADA_UNIVERSE } from '@/lib/universe'
import { mapWithConcurrency } from '@/lib/async-limit'
import { getFromCache, setCache } from '@/lib/providers/cache'
import { getQuoteWithFallback } from '@/lib/providers/market-data'

const FMP_KEYS = [
  process.env.FINANCIALMODELINGPREP_API_KEY,
  process.env.FINANCIALMODELINGPREP_API_KEY_SECONDARY,
].filter(Boolean) as string[]

async function fetchFmp<T>(url: string) {
  let lastStatus = 500
  for (const key of FMP_KEYS) {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}apikey=${key}`, { cache: 'no-store' })
    lastStatus = res.status
    if (!res.ok && (res.status === 429 || res.status >= 500)) continue
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  }
  return { ok: false, status: lastStatus, data: null }
}

function normalizeYield(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return value <= 1 ? value * 100 : value
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const exchange = searchParams.get('exchange') || 'ALL'
    const minYieldInput = parseFloat(searchParams.get('minYield') || '0')
    const minYieldPct = minYieldInput <= 1 ? minYieldInput * 100 : minYieldInput
    const limit = parseInt(searchParams.get('limit') || '25')
    const cacheKey = `dividend-yield:${exchange}:${minYieldPct}:${limit}`
    const cached = getFromCache<any>(cacheKey)
    if (cached && !cached.isStale) {
      return NextResponse.json(cached.value, {
        headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1200' },
      })
    }

    let symbolList = [...TOP_US_UNIVERSE, ...TOP_CANADA_UNIVERSE]
    if (exchange !== 'ALL') {
      symbolList = symbolList.filter((sym) => parseSymbol(sym).exchange === exchange)
    }

    const rows = await mapWithConcurrency(symbolList, 6, async (symbol) => {
      const [metricsRes, profileRes] = await Promise.all([
        fetchFmp(`https://financialmodelingprep.com/api/v3/key-metrics-ttm/${symbol}`),
        fetchFmp(`https://financialmodelingprep.com/api/v3/profile/${symbol}`),
      ])

      const metrics = metricsRes.ok ? metricsRes.data?.[0] : null
      const profile = profileRes.ok ? profileRes.data?.[0] : null
      const price = Number(profile?.price) || null
      const lastDiv = Number(profile?.lastDiv) || null

      const rawYield = pickFirst(
        normalizeYield(metrics?.dividendYieldTTM),
        normalizeYield(metrics?.dividendYieldPercentageTTM),
        normalizeYield(metrics?.dividendYield),
        lastDiv && price ? (lastDiv / price) * 100 : null
      )

      return {
        symbol,
        name: profile?.companyName || symbol,
        dividend_yield: rawYield ?? null,
        price,
      }
    })

    const ranked = rows
      .filter((row) => Number.isFinite(row.dividend_yield) && (row.dividend_yield as number) > 0)
      .filter((row) => (row.dividend_yield as number) >= minYieldPct)
      .sort((a, b) => (b.dividend_yield as number) - (a.dividend_yield as number))
      .slice(0, Math.max(limit, 10))

    const withQuotes = await mapWithConcurrency(ranked, 6, async (row) => {
      const parsed = parseSymbol(row.symbol)
      let price = row.price
      let changePercent = 0
      try {
        const quote = await getQuoteWithFallback(row.symbol)
        price = quote?.price ?? price
        changePercent = quote?.changePct ?? 0
      } catch {}

      let dividendLabel = 'Dividend'
      if ((row.dividend_yield as number) >= 4) dividendLabel = 'High Yield'
      else if ((row.dividend_yield as number) >= 2) dividendLabel = 'Steady Yield'
      else if ((row.dividend_yield as number) > 0) dividendLabel = 'Low Yield'

      return {
        symbol: parsed.normalizedSymbol || row.symbol,
        name: row.name || row.symbol,
        exchange: parsed.exchange,
        currency: parsed.currency,
        dividend_yield: row.dividend_yield,
        price: price ?? 0,
        changePercent,
        change: changePercent,
        dividendLabel,
        rationale: row.dividend_yield
          ? `Dividend yield ${Number(row.dividend_yield).toFixed(2)}%.`
          : 'Dividend yield unavailable.',
      }
    })

    const payload = {
      stocks: withQuotes.slice(0, limit),
      timestamp: Date.now(),
    }

    setCache(cacheKey, payload, 10 * 60 * 1000)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1200' },
    })
  } catch (error: any) {
    console.error('Dividend-momentum screener API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dividend-momentum stocks' },
      { status: 500 }
    )
  }
}

function pickFirst<T>(...values: Array<T | null | undefined>) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value
  }
  return null
}
