import { NextRequest, NextResponse } from 'next/server'
import { getComprehensiveQuote } from '@/lib/comprehensive-quote'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbolsParam = searchParams.get('symbols')

    if (!symbolsParam) {
      return NextResponse.json(
        { error: 'Symbols parameter is required' },
        { status: 400 }
      )
    }

    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase())
    
    // Fetch quotes for all symbols in parallel using comprehensive source
    const quotes = await Promise.allSettled(
      symbols.map(async (symbol) => {
        try {
          const data = await getComprehensiveQuote(symbol)
          return {
            symbol,
            data: {
              price: data.price,
              change: data.change,
              dp: data.changePct,
              high: data.high,
              low: data.low,
              open: data.open,
              previousClose: data.previousClose,
              volume: data.volume,
              marketCap: data.marketCap,
              peRatio: data.peRatio,
              week52High: data.week52High,
              week52Low: data.week52Low,
            },
          }
        } catch (error) {
          console.log(`Failed to fetch quote for ${symbol}`)
          return {
            symbol,
            data: { price: 0, change: 0, dp: 0, marketCap: 0, week52High: 0, week52Low: 0 },
            error: 'Failed to fetch',
          }
        }
      })
    )

    const successfulQuotes = quotes
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value)

    return NextResponse.json({
      quotes: successfulQuotes,
    })
  } catch (error: any) {
    console.error('Quotes API error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
