import { NextRequest, NextResponse } from 'next/server'

const SECTOR_ETFS: Record<string, string> = {
  'Technology': 'XLK',
  'Healthcare': 'XLV',
  'Financials': 'XLF',
  'Consumer Discretionary': 'XLY',
  'Communication Services': 'XLC',
  'Industrials': 'XLI',
  'Consumer Staples': 'XLP',
  'Energy': 'XLE',
  'Utilities': 'XLU',
  'Real Estate': 'XLRE',
  'Materials': 'XLB',
}

export async function GET(req: NextRequest) {
  try {
    const symbols = Object.values(SECTOR_ETFS).join(',')
    
    const quotesRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols}`)
    const quotes = await quotesRes.json().catch(() => ({ quotes: [] }))

    const sectors = Object.entries(SECTOR_ETFS).map(([name, symbol]) => {
      const quote = quotes.quotes?.find((q: any) => q.symbol === symbol)
      const payload = quote?.data ?? quote ?? {}
      const changePercent = parseFloat(payload?.dp ?? payload?.changePercent ?? 0)
      const change = parseFloat(payload?.change ?? 0)
      return {
        name,
        symbol,
        change,
        changePercent,
        strength: Math.abs(changePercent),
      }
    }).sort((a, b) => b.strength - a.strength)

    return NextResponse.json({
      sectors,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Sector momentum API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sector momentum' },
      { status: 500 }
    )
  }
}
