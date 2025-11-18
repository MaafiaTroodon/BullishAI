import { NextRequest, NextResponse } from 'next/server'
import { getQuoteWithFallback } from '@/lib/providers/market-data'
import { getCandles } from '@/lib/market-data'
import { getMultiSourceNews } from '@/lib/news-multi-source'
import { resolveMarketCapUSD, formatMarketCapShort, formatMarketCapFull } from '@/lib/finance/marketCap'
import axios from 'axios'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 10

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  let symbol = 'UNKNOWN'
  try {
    const { symbol: symbolParam } = await params
    symbol = symbolParam.toUpperCase()
    const { searchParams } = new URL(request.url)
    const range = (searchParams.get('range') || '1D').toUpperCase() as any

    // Fetch candles for chart (needed for fallback values too)
    let candlesResult
    try {
      candlesResult = await getCandles(symbol, range.toLowerCase())
    } catch (error: any) {
      console.error(`Failed to fetch candles for ${symbol}:`, error.message)
      candlesResult = { data: [], source: 'none' }
    }

    // Fetch quote with market cap (fallbacks to candles if quote provider fails)
    let quote
    try {
      quote = await getQuoteWithFallback(symbol)
    } catch (error: any) {
      console.error(`Failed to fetch live quote for ${symbol}:`, error.message)
      const fallbackQuote = buildQuoteFromCandles(candlesResult.data)
      if (!fallbackQuote) {
        return NextResponse.json(
          { error: `Failed to fetch quote for ${symbol}` },
          { status: 502 }
        )
      }
      quote = fallbackQuote
    }

    // Resolve market cap with all fallbacks including hardcoded values
    const marketCapResult = await resolveMarketCapUSD(symbol, quote.price)
    const marketCap = marketCapResult.raw || quote.marketCap || 0
    const marketCapShort = marketCap ? formatMarketCapShort(marketCap) : null
    const marketCapFull = marketCap ? formatMarketCapFull(marketCap) : null

    // Fetch news
    let news: any[] = []
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

    // Try to get company name from quote summary
    let companyName = null
    try {
      const summaryResponse = await axios.get(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=summaryProfile`,
        { timeout: 3000 }
      )
      
      if (summaryResponse?.data?.quoteSummary?.result?.[0]?.summaryProfile) {
        companyName = summaryResponse.data.quoteSummary.result[0].summaryProfile.longName || 
                      summaryResponse.data.quoteSummary.result[0].summaryProfile.shortName || 
                      symbol
      }
    } catch (error: any) {
      // If company name fetch fails, use symbol as fallback
      companyName = symbol
    }

    return NextResponse.json({
      symbol,
      companyName: companyName || symbol,
      quote: {
        price: quote.price,
        change: quote.change,
        changePct: quote.changePct,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        previousClose: quote.previousClose,
        volume: quote.volume,
        marketCap: marketCap,
        marketCapShort: marketCapShort,
        marketCapFull: marketCapFull,
        marketCapSource: marketCapResult.source,
        currency: quote.currency || 'USD',
        fetchedAt: quote.fetchedAt,
        stale: !!quote.stale,
        source: quote.source,
      },
      candles: candlesResult.data,
      chartSource: candlesResult.source,
      changePctOverRange,
      news,
    })
  } catch (error: any) {
    console.error(`Stock API error for ${symbol}:`, error.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

type CandlePoint = {
  c?: number
  o?: number
  h?: number
  l?: number
  v?: number
}

function buildQuoteFromCandles(candles: CandlePoint[] | undefined | null) {
  if (!candles || !candles.length) {
    return null
  }

  const closes = candles
    .map((c) => (typeof c.c === 'number' ? c.c : undefined))
    .filter((n): n is number => typeof n === 'number')
  if (closes.length === 0) return null

  const price = closes[closes.length - 1]
  const prevClose = closes.length > 1 ? closes[closes.length - 2] : closes[0]
  const change = prevClose != null ? price - prevClose : 0
  const changePct = prevClose ? (change / prevClose) * 100 : 0

  const highs = candles
    .map((c) => (typeof c.h === 'number' ? c.h : undefined))
    .filter((n): n is number => typeof n === 'number')
  const lows = candles
    .map((c) => (typeof c.l === 'number' ? c.l : undefined))
    .filter((n): n is number => typeof n === 'number')
  const opens = candles
    .map((c) => (typeof c.o === 'number' ? c.o : undefined))
    .filter((n): n is number => typeof n === 'number')
  const volumes = candles
    .map((c) => (typeof c.v === 'number' ? c.v : undefined))
    .filter((n): n is number => typeof n === 'number')

  return {
    price,
    change,
    changePct,
    open: opens.length ? opens[0] : price,
    high: highs.length ? Math.max(...highs) : price,
    low: lows.length ? Math.min(...lows) : price,
    previousClose: prevClose ?? price,
    volume: volumes.length ? volumes[volumes.length - 1] : 0,
    marketCap: 0,
    currency: 'USD',
    fetchedAt: new Date().toISOString(),
    stale: true,
    source: 'candles-fallback',
  }
}

