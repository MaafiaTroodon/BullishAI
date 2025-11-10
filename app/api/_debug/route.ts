import { NextRequest, NextResponse } from 'next/server'

// Only available in development
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Handle both GET and OPTIONS for CORS
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }
  const env = {
    databaseUrl: !!process.env.DATABASE_URL,
    finnhub: !!process.env.FINNHUB_API_KEY,
    twelvedata: !!process.env.TWELVEDATA_API_KEY,
    alphavantage: !!process.env.ALPHAVANTAGE_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
  }

  const providers = {
    quote: 'ok',
    candles: 'ok',
    news: 'ok',
  }

  // Test providers with AAPL
  try {
    const quoteTest = await fetch('https://finnhub.io/api/v1/quote?symbol=AAPL&token=' + (process.env.FINNHUB_API_KEY || ''))
    if (!quoteTest.ok) providers.quote = 'fail'
  } catch (error) {
    providers.quote = 'fail'
  }

  try {
    const newsTest = await fetch('https://finnhub.io/api/v1/news?category=general&token=' + (process.env.FINNHUB_API_KEY || ''))
    if (!newsTest.ok) providers.news = 'fail'
  } catch (error) {
    providers.news = 'fail'
  }

  return NextResponse.json({
    env,
    providers,
  })
}

