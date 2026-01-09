import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'
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

function safeNumber(value: any) {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(req: NextRequest) {
  try {
    const cacheKey = 'value-quality:v2'
    const cached = getFromCache<any>(cacheKey)
    if (cached && !cached.isStale) {
      return NextResponse.json(cached.value, {
        headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1200' },
      })
    }

    // Fetch popular stocks
    const popularRes = await fetch(`${req.nextUrl.origin}/api/popular-stocks`)
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))

    // Always use fallback stocks to ensure we have proper data (US + Canadian)
    const fallbackStocks = [
      // US stocks
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corporation' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.' },
      { symbol: 'TSLA', name: 'Tesla Inc.' },
      { symbol: 'META', name: 'Meta Platforms Inc.' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation' },
      { symbol: 'NFLX', name: 'Netflix Inc.' },
      { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
      { symbol: 'V', name: 'Visa Inc.' },
      // Canadian stocks
      { symbol: 'RY.TO', name: 'Royal Bank of Canada' },
      { symbol: 'TD.TO', name: 'Toronto-Dominion Bank' },
      { symbol: 'SHOP.TO', name: 'Shopify Inc.' },
      { symbol: 'CNQ.TO', name: 'Canadian Natural Resources' },
      { symbol: 'ENB.TO', name: 'Enbridge Inc.' },
      { symbol: 'TRP.TO', name: 'TC Energy Corporation' },
      { symbol: 'BAM.TO', name: 'Brookfield Asset Management' },
      { symbol: 'CP.TO', name: 'Canadian Pacific Kansas City' },
      { symbol: 'CNR.TO', name: 'Canadian National Railway' },
      { symbol: 'ATD.TO', name: 'Alimentation Couche-Tard' },
    ]
    
    const symbols = (popular.stocks || [])
      .slice(0, 30)
      .map((s: any) => s.symbol)
      .filter(Boolean)

    const symbolList = [...new Set([...symbols, ...fallbackStocks.map((s) => s.symbol)])].slice(0, 20)

    const stockDetails = await mapWithConcurrency(symbolList, 6, async (symbol) => {
      try {
        const [quote, finnhubMetricRes, fmpMetricsRes, fmpIncomeRes] = await Promise.all([
          getQuoteWithFallback(symbol).catch(() => null),
          finnhubFetch('stock/metric', { symbol, metric: 'all' }, { cacheSeconds: 3600 }).catch(() => null),
          fetchFmp(`https://financialmodelingprep.com/api/v3/key-metrics-ttm/${symbol}`),
          fetchFmp(`https://financialmodelingprep.com/api/v3/income-statement/${symbol}?limit=2`),
        ])

        const finnhubMetric = finnhubMetricRes?.data?.metric || {}
        const fmpMetrics = fmpMetricsRes.ok ? fmpMetricsRes.data?.[0] : null
        const fmpIncome = fmpIncomeRes.ok ? fmpIncomeRes.data || [] : []

        const latestIncome = fmpIncome?.[0]
        const prevIncome = fmpIncome?.[1]
        const revenueGrowth = (() => {
          const latest = safeNumber(latestIncome?.revenue)
          const prev = safeNumber(prevIncome?.revenue)
          if (!latest || !prev || prev === 0) return null
          return ((latest - prev) / prev) * 100
        })()

        const metricGrowth = safeNumber(finnhubMetric.revenueGrowthTTM ?? finnhubMetric.revenueGrowth5Y)
        const fmpGrowth = safeNumber(fmpMetrics?.revenueGrowthTTM ?? fmpMetrics?.revenueGrowth)
        const resolvedGrowth = revenueGrowth ?? metricGrowth ?? fmpGrowth

        const marketCap = safeNumber(finnhubMetric.marketCapitalization)
        const peRatio = safeNumber(finnhubMetric.peTTM) ?? safeNumber(fmpMetrics?.peRatioTTM)
        const roe = safeNumber(finnhubMetric.roeTTM) ?? safeNumber(fmpMetrics?.roeTTM) ?? safeNumber(fmpMetrics?.roe)
        const price = safeNumber(quote?.price)
        const change = safeNumber(quote?.changePct)
        const week52High = safeNumber(finnhubMetric['52WeekHigh'])
        const week52Low = safeNumber(finnhubMetric['52WeekLow'])
        const dividendYield = safeNumber(finnhubMetric.dividendYieldIndicatedAnnual)

        if (!price) return null

        return {
          symbol,
          name: symbol,
          price,
          change: change ?? 0,
          peRatio,
          roe,
          revenue_growth: resolvedGrowth,
          quality_score: (Number.isFinite(roe) ? roe : null),
          week52High,
          week52Low,
          marketCap: marketCap ? marketCap * 1_000_000 : null,
          dividendYield,
        }
      } catch {
        return null
      }
    })

    const stocks = stockDetails
      .filter((item): item is NonNullable<typeof item> => !!item && item.price > 0)
      .map((item) => {
        const pe = item.peRatio
        const week52High = item.week52High
        const price = item.price
        const discount = week52High ? (week52High - price) / week52High : null
        let valueLabel = 'Limited data'
        let qualityLabel = 'Limited data'
        let rationale = 'Limited valuation data available.'

        if (typeof pe === 'number') {
          if (pe <= 18 && discount != null && discount >= 0.1) {
            valueLabel = 'Undervalued'
          } else if (pe <= 28) {
            valueLabel = 'Fairly Valued'
          } else {
            valueLabel = 'Premium'
          }
          rationale = `P/E ${pe.toFixed(1)}${week52High ? `, 52W high $${week52High.toFixed(2)}` : ''}.`
        }

        const cap = item.marketCap || 0
        if (cap >= 200_000_000_000) {
          qualityLabel = 'High Quality'
        } else if (cap >= 50_000_000_000) {
          qualityLabel = 'Stable'
        } else if (cap > 0) {
          qualityLabel = 'Emerging'
        }

        if (item.dividendYield != null && Number.isFinite(item.dividendYield)) {
          rationale += ` Dividend yield ${item.dividendYield.toFixed(2)}%.`
        }

        return {
          symbol: item.symbol,
          name: item.name,
          price: item.price,
          change: item.change,
          pe: item.peRatio,
          roe: item.roe,
          revenue_growth: item.revenue_growth,
          quality_score: item.quality_score,
          week52High: item.week52High,
          week52Low: item.week52Low,
          marketCap: item.marketCap,
          dividend_yield: item.dividendYield,
          valueLabel,
          qualityLabel,
          rationale,
        }
      })
      .sort((a, b) => (a.pe ?? 99) - (b.pe ?? 99))
      .slice(0, 10)

    const payload = { stocks, timestamp: Date.now() }
    setCache(cacheKey, payload, 15 * 60 * 1000)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1200' },
    })
  } catch (error: any) {
    console.error('Value-quality screener API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch value-quality stocks' },
      { status: 500 }
    )
  }
}
