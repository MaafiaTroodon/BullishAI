import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function estimateNextPayment(lastPayDate?: string | null, frequency?: string | null) {
  if (!lastPayDate || !frequency) return null
  const date = new Date(lastPayDate)
  if (Number.isNaN(date.getTime())) return null
  const lower = frequency.toLowerCase()
  if (lower.includes('quarter')) date.setMonth(date.getMonth() + 3)
  else if (lower.includes('semi')) date.setMonth(date.getMonth() + 6)
  else if (lower.includes('month')) date.setMonth(date.getMonth() + 1)
  else if (lower.includes('annual') || lower.includes('year')) date.setFullYear(date.getFullYear() + 1)
  else return null
  return date.toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const symbol = url.searchParams.get('symbol')?.toUpperCase()
    if (!symbol) {
      return NextResponse.json({ error: 'symbol_required' }, { status: 400 })
    }

    const [dividendRes, metricRes, financialsRes] = await Promise.all([
      finnhubFetch('stock/dividend', { symbol }, { cacheSeconds: 3600 }),
      finnhubFetch('stock/metric', { symbol, metric: 'all' }, { cacheSeconds: 3600 }),
      finnhubFetch('stock/financials', { symbol }, { cacheSeconds: 3600 }),
    ])

    const dividends = Array.isArray(dividendRes.data) ? dividendRes.data : []
    const metric = metricRes.data?.metric || {}
    const financials = financialsRes.data || {}

    const latest = dividends[0] || null
    const last = latest?.payDate || latest?.paymentDate || null
    const next = latest?.exDate || latest?.date || null
    const frequency = latest?.frequency || metric.dividendFrequency || null

    return NextResponse.json(
      {
        symbol,
        dividendYield: metric.dividendYieldTTM ?? metric.dividendYieldIndicatedAnnual ?? null,
        payoutRatio: metric.payoutRatioTTM ?? null,
        lastDividend: last,
        nextDividend: next,
        expectedPaymentWindow: estimateNextPayment(last, frequency),
        amount: latest?.amount ?? null,
        frequency,
        quality: {
          positiveFcf: financials?.totalCashFromOperatingActivitiesTTM ? financials.totalCashFromOperatingActivitiesTTM > 0 : null,
          debtToEquity: metric.totalDebtToEquityTTM ?? null,
        },
      },
      {
        headers: {
          'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600',
        },
      }
    )
  } catch (error: any) {
    console.error('Dividend intelligence error:', error)
    return NextResponse.json(
      { error: error.message || 'dividend_intelligence_error' },
      { status: 500 }
    )
  }
}
