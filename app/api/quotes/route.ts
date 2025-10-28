import { NextRequest, NextResponse } from 'next/server'
import { getComprehensiveQuote } from '@/lib/comprehensive-quote'
import { resolveMarketCap } from '@/lib/finance/marketCap'

// Helper function to format market cap
function formatMarketCap(value: number): string | null {
  if (!value || value === 0) return null
  
  const billions = value / 1e9
  
  if (billions < 0.001) {
    return `${(billions * 1000).toFixed(1)}M`
  } else if (billions < 1) {
    return `${billions.toFixed(2)}B`
  } else if (billions < 1000) {
    return `${billions.toFixed(2)}B`
  } else {
    return `${(billions / 1000).toFixed(2)}T`
  }
}

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
          
          // Get market cap with fallback
          let marketCapData = { raw: data.marketCap || null, short: null, source: 'none' }
          if (!data.marketCap || data.marketCap === 0) {
            marketCapData = await resolveMarketCap(symbol, data.price)
          } else {
            // Format the existing market cap
            marketCapData = {
              raw: data.marketCap,
              short: data.marketCap > 0 ? formatMarketCap(data.marketCap) : null,
              source: 'quote-api',
            }
          }
          
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
              marketCap: marketCapData.raw,
              marketCapShort: marketCapData.short,
              marketCapSource: marketCapData.source,
              peRatio: data.peRatio,
              week52High: data.week52High,
              week52Low: data.week52Low,
            },
          }
        } catch (error) {
          console.log(`Failed to fetch quote for ${symbol}`)
          return {
            symbol,
            data: { price: 0, change: 0, dp: 0, marketCap: null, marketCapShort: null, week52High: 0, week52Low: 0 },
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
