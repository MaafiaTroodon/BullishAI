import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const symbolsParam = url.searchParams.get('symbols')
    if (!symbolsParam) {
      return NextResponse.json({ items: [], error: 'symbols_required' }, { status: 400 })
    }
    const symbols = symbolsParam
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 30)

    const baseUrl = req.nextUrl.origin
    const quotesRes = await fetch(`${baseUrl}/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}`, { cache: 'no-store' })
    const quotesJson = await quotesRes.json().catch(() => ({ quotes: [] }))
    const quoteMap = new Map<string, any>()
    for (const quote of quotesJson.quotes || []) {
      if (quote?.symbol) {
        quoteMap.set(String(quote.symbol).toUpperCase(), quote.data || {})
      }
    }

    const items = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const res = await fetch(`${baseUrl}/api/stocks/${encodeURIComponent(symbol)}`, { cache: 'no-store' })
        if (!res.ok) return null
        const data = await res.json().catch(() => null)
        const dividendYield = data?.dividendYield ?? data?.fundamentals?.dividendYield ?? null
        const quote = quoteMap.get(symbol) || {}
        return {
          symbol,
          dividendYield,
          marketCap: quote.marketCap ?? null,
          price: quote.price ?? null,
          exDate: null,
          payDate: null,
          amount: null,
        }
      })
    )

    const filtered = items
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value)
      .filter(Boolean)

    return NextResponse.json({ items: filtered })
  } catch (error: any) {
    console.error('Dividend fallback API error:', error)
    return NextResponse.json({ items: [], error: error.message || 'dividend_fallback_error' }, { status: 500 })
  }
}
