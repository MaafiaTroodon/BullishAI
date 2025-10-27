import { NextRequest, NextResponse } from 'next/server'
import { getComprehensiveQuote } from '@/lib/comprehensive-quote'
import { getCandles } from '@/lib/market-data'
import { getMultiSourceNews } from '@/lib/news-multi-source'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 10

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol: symbolParam } = await params
    const symbol = symbolParam.toUpperCase()
    const { searchParams } = new URL(request.url)
    const range = (searchParams.get('range') || '1D').toUpperCase() as any

    // Fetch quote with market cap
    let quote
    try {
      quote = await getComprehensiveQuote(symbol)
    } catch (error: any) {
      console.error(`Failed to fetch quote for ${symbol}:`, error.message)
      return NextResponse.json(
        { error: `Failed to fetch quote for ${symbol}` },
        { status: 502 }
      )
    }

    // Fetch candles for chart
    let candlesResult
    try {
      candlesResult = await getCandles(symbol, range.toLowerCase())
    } catch (error: any) {
      console.error(`Failed to fetch candles for ${symbol}:`, error.message)
      candlesResult = { data: [], source: 'none' }
    }

    // Fetch news
    let news = []
    try {
      const newsData = await getMultiSourceNews(symbol)
      news = newsData.slice(0, 10) // Limit to 10 items
    } catch (error: any) {
      console.error(`Failed to fetch news for ${symbol}:`, error.message)
      news = []
    }

    // Calculate percent change over the range
    let changePctOverRange = null
    if (candlesResult.data && candlesResult.data.length > 1) {
      const firstPrice = candlesResult.data[0].c
      const lastPrice = candlesResult.data[candlesResult.data.length - 1].c
      if (firstPrice > 0) {
        changePctOverRange = ((lastPrice - firstPrice) / firstPrice) * 100
      }
    }

    return NextResponse.json({
      symbol,
      quote: {
        price: quote.price,
        change: quote.change,
        changePct: quote.changePct,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        previousClose: quote.previousClose,
        volume: quote.volume,
        marketCap: quote.marketCap,
        peRatio: quote.peRatio,
        week52High: quote.week52High,
        week52Low: quote.week52Low,
        source: quote.source,
      },
      candles: candlesResult.data,
      chartSource: candlesResult.source,
      changePctOverRange,
      news,
    })
  } catch (error: any) {
    console.error(`Stock API error for ${params.symbol}:`, error.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

