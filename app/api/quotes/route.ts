import { NextRequest, NextResponse } from 'next/server'
import { getQuoteWithFallback } from '@/lib/providers/market-data'
import { resolveMarketCapUSD, formatMarketCapShort, formatMarketCapFull } from '@/lib/finance/marketCap'

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
          const quote = await getQuoteWithFallback(symbol)
          
          // Resolve market cap with proper formatting
          const marketCapResult = await resolveMarketCapUSD(symbol, quote.price)
          const marketCap = marketCapResult.raw
          
          return {
            symbol,
            data: {
              price: quote.price,
              change: quote.change,
              dp: quote.changePct,
              high: quote.high,
              low: quote.low,
              open: quote.open,
              previousClose: quote.previousClose,
              volume: quote.volume,
              marketCap,
              marketCapShort: marketCap ? formatMarketCapShort(marketCap) : null,
              marketCapFull: marketCap ? formatMarketCapFull(marketCap) : null,
              marketCapSource: marketCapResult.source,
              currency: quote.currency || 'USD',
              source: quote.source,
              fetchedAt: quote.fetchedAt,
              stale: !!quote.stale,
              peRatio: null,
              week52High: null,
              week52Low: null,
            },
          }
        } catch (error) {
          console.log(`Failed to fetch quote for ${symbol}`)
          return {
            symbol,
            data: { 
              price: 0, 
              change: 0, 
              dp: 0, 
              marketCap: null,
              marketCapShort: null,
              marketCapFull: null,
              marketCapSource: 'none',
              week52High: 0, 
              week52Low: 0 
            },
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
