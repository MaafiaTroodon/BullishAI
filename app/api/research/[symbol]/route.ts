import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'
import { getFromCache, setCache } from '@/lib/providers/cache'
import { getQuote as getTwelveQuote } from '@/lib/twelvedata'
import { getQuote as getAlphaQuote } from '@/lib/alphavantage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

function normalizeTimestamp(ts?: number) {
  if (!ts || !Number.isFinite(ts)) return null
  return ts < 1_000_000_000_000 ? ts * 1000 : ts
}

function pickFirst<T>(...values: Array<T | null | undefined>) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value
  }
  return null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const resolvedParams = await params
    const symbol = String(resolvedParams.symbol || '').toUpperCase()
    if (!symbol) {
      return NextResponse.json({ error: 'symbol_required' }, { status: 400 })
    }

    const cacheKey = `research:${symbol}`
    const cached = getFromCache<any>(cacheKey)
    if (cached && !cached.isStale) {
      return NextResponse.json(cached.value, {
        headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
      })
    }

    const newsWindow = (() => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 7)
      return { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] }
    })()

    const [
      quoteRes,
      metricRes,
      profileRes,
      financialsReportedRes,
      financialsRes,
      dividendRes,
      newsRes,
      fmpProfileRes,
      fmpMetricsRes,
      fmpDividendRes,
      fmpNewsRes,
      alphaOverviewRes,
      twelveQuoteRes,
      alphaQuoteRes,
    ] = await Promise.allSettled([
      finnhubFetch('quote', { symbol }, { cacheSeconds: 30 }),
      finnhubFetch('stock/metric', { symbol, metric: 'all' }, { cacheSeconds: 3600 }),
      finnhubFetch('stock/profile2', { symbol }, { cacheSeconds: 3600 }),
      finnhubFetch('stock/financials-reported', { symbol, freq: 'quarterly' }, { cacheSeconds: 3600 }),
      finnhubFetch('stock/financials', { symbol, statement: 'ic', freq: 'quarterly' }, { cacheSeconds: 3600 }),
      finnhubFetch('stock/dividend', { symbol }, { cacheSeconds: 3600 }),
      finnhubFetch('company-news', { symbol, from: newsWindow.from, to: newsWindow.to }, { cacheSeconds: 900 }),
      fetchFmp(`https://financialmodelingprep.com/api/v3/profile/${symbol}`),
      fetchFmp(`https://financialmodelingprep.com/api/v3/key-metrics-ttm/${symbol}`),
      fetchFmp(`https://financialmodelingprep.com/api/v3/stock_dividend/${symbol}`),
      fetchFmp(`https://financialmodelingprep.com/api/v3/stock_news?tickers=${symbol}&limit=5`),
      process.env.ALPHAVANTAGE_API_KEY
        ? fetch(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${process.env.ALPHAVANTAGE_API_KEY}`).then((r) =>
            r.json().catch(() => null)
          )
        : Promise.resolve(null),
      getTwelveQuote(symbol).catch(() => null),
      getAlphaQuote(symbol).catch(() => null),
    ])

    const finnhubQuote = quoteRes.status === 'fulfilled' ? quoteRes.value.data || {} : {}
    const finnhubMetric = metricRes.status === 'fulfilled' ? metricRes.value.data?.metric || {} : {}
    const finnhubProfile = profileRes.status === 'fulfilled' ? profileRes.value.data || {} : {}
    const finnhubFinancialsReported =
      financialsReportedRes.status === 'fulfilled' ? financialsReportedRes.value.data?.data || [] : []
    const finnhubFinancials = financialsRes.status === 'fulfilled' ? financialsRes.value.data?.financials || [] : []
    const finnhubDividend = dividendRes.status === 'fulfilled' ? dividendRes.value.data || [] : []
    const finnhubNews = newsRes.status === 'fulfilled' ? newsRes.value.data || [] : []

    const fmpProfile = fmpProfileRes.status === 'fulfilled' ? fmpProfileRes.value.data?.[0] : null
    const fmpMetrics = fmpMetricsRes.status === 'fulfilled' ? fmpMetricsRes.value.data?.[0] : null
    const fmpDividends = fmpDividendRes.status === 'fulfilled' ? fmpDividendRes.value.data?.historical || [] : []
    const fmpNews = fmpNewsRes.status === 'fulfilled' ? fmpNewsRes.value.data || [] : []

    const alphaOverview = alphaOverviewRes.status === 'fulfilled' ? alphaOverviewRes.value || {} : {}
    const twelveQuote = twelveQuoteRes.status === 'fulfilled' ? twelveQuoteRes.value : null
    const alphaQuote = alphaQuoteRes.status === 'fulfilled' ? alphaQuoteRes.value : null

    const price = pickFirst(
      Number(finnhubQuote.c),
      Number(twelveQuote?.c),
      Number(alphaQuote?.c),
      Number(fmpProfile?.price)
    )
    const changePercent = pickFirst(Number(finnhubQuote.dp), Number(alphaQuote?.dp), 0)
    const volume = pickFirst(Number(finnhubQuote.v), Number(twelveQuote?.v), Number(alphaQuote?.v), null)

    const marketCap = pickFirst(
      Number(finnhubMetric.marketCapitalization) * 1_000_000,
      Number(fmpProfile?.mktCap),
      Number(alphaOverview.MarketCapitalization)
    )
    const pe = pickFirst(Number(finnhubMetric.peTTM), Number(fmpMetrics?.peRatioTTM), Number(alphaOverview.PERatio))
    const fiftyTwoWeekHigh = pickFirst(
      Number(finnhubMetric['52WeekHigh']),
      Number(alphaOverview['52WeekHigh'])
    )
    const fiftyTwoWeekLow = pickFirst(
      Number(finnhubMetric['52WeekLow']),
      Number(alphaOverview['52WeekLow'])
    )

    const epsTTM = pickFirst(
      Number(finnhubMetric.epsTTM),
      Number(fmpMetrics?.epsTTM),
      Number(alphaOverview.EPS)
    )
    const revenueTTM = pickFirst(
      Number(finnhubMetric.revenueTTM),
      Number(fmpMetrics?.revenueTTM),
      Number(alphaOverview.RevenueTTM)
    )

    const dividendYield = pickFirst(
      Number(finnhubMetric.dividendYieldIndicatedAnnual),
      Number(alphaOverview.DividendYield) * 100,
      Number(fmpProfile?.lastDiv)
    )
    const lastDividend = pickFirst(
      finnhubDividend?.[0]?.amount,
      fmpDividends?.[0]?.dividend,
      alphaOverview.DividendPerShare ? Number(alphaOverview.DividendPerShare) : null
    )
    const nextDividend = pickFirst(finnhubDividend?.[0]?.paymentDate, null)

    const newsItems = [
      ...(Array.isArray(finnhubNews) ? finnhubNews : []),
      ...(Array.isArray(fmpNews) ? fmpNews : []),
    ]
      .map((item: any) => ({
        headline: item.headline || item.title || '',
        summary: item.summary || item.text || '',
        source: item.source || item.site || 'News',
        datetime: normalizeTimestamp(item.datetime || item.publishedDate || item.date),
        url: item.url || item.link || null,
      }))
      .filter((item: any) => item.headline)
      .slice(0, 5)

    const payload = {
      symbol,
      profile: {
        name: pickFirst(finnhubProfile.name, fmpProfile?.companyName) || symbol,
        exchange: pickFirst(finnhubProfile.exchange, fmpProfile?.exchangeShortName),
        sector: pickFirst(finnhubProfile.finnhubIndustry, fmpProfile?.sector),
      },
      quote: {
        price,
        changePercent,
        volume,
      },
      metrics: {
        marketCap,
        pe,
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
      },
      financials: {
        revenueTTM,
        epsTTM,
        reported: finnhubFinancialsReported?.[0] || null,
        income: finnhubFinancials?.[0] || null,
      },
      dividends: {
        yield: dividendYield,
        last: lastDividend,
        next: nextDividend,
      },
      news: newsItems,
      updatedAt: new Date().toISOString(),
    }

    setCache(cacheKey, payload, 5 * 60 * 1000)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error: any) {
    console.error('Research API error:', error)
    return NextResponse.json(
      { error: error.message || 'research_error' },
      { status: 500 }
    )
  }
}
