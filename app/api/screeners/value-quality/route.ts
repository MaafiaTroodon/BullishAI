import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
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

    const stockDetails = await Promise.all(
      symbolList.map(async (symbol) => {
        try {
          const res = await fetch(`${req.nextUrl.origin}/api/stocks/${symbol}`)
          const data = await res.json().catch(() => null)
          if (!data?.quote) return null
          return {
            symbol: data.symbol || symbol,
            name: data.companyName || symbol,
            price: data.quote.price || 0,
            change: data.quote.changePct || 0,
            peRatio: data.quote.peRatio ?? data.fundamentals?.peRatio ?? null,
            week52High: data.quote.week52High ?? data.fundamentals?.week52High ?? null,
            week52Low: data.quote.week52Low ?? data.fundamentals?.week52Low ?? null,
            marketCap: data.quote.marketCap ?? data.fundamentals?.marketCap ?? null,
            dividendYield: data.fundamentals?.dividendYield ?? null,
          }
        } catch {
          return null
        }
      })
    )

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
          peRatio: item.peRatio,
          week52High: item.week52High,
          week52Low: item.week52Low,
          marketCap: item.marketCap,
          dividend_yield: item.dividendYield,
          valueLabel,
          qualityLabel,
          rationale,
        }
      })
      .sort((a, b) => (a.peRatio ?? 99) - (b.peRatio ?? 99))
      .slice(0, 10)

    return NextResponse.json({
      stocks,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Value-quality screener API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch value-quality stocks' },
      { status: 500 }
    )
  }
}
