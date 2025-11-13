import { NextRequest, NextResponse } from 'next/server'

// Only available in development
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Handle both GET and OPTIONS for CORS
export async function GET(request: NextRequest) {
  // Allow in both development and production (can be restricted later)
  // if (process.env.NODE_ENV === 'production') {
  //   return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  // }
  // Get auth baseURL (without importing auth to avoid circular deps)
  function getAuthBaseURL(): string {
    if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL
    if (process.env.NEXT_PUBLIC_BETTER_AUTH_URL) return process.env.NEXT_PUBLIC_BETTER_AUTH_URL
    if (process.env.NETLIFY) {
      const netlifyUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
      if (netlifyUrl) {
        return netlifyUrl.startsWith('http') ? netlifyUrl : `https://${netlifyUrl}`
      }
    }
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
    return "http://localhost:3000"
  }

  const env = {
    databaseUrl: !!process.env.DATABASE_URL,
    finnhub: !!process.env.FINNHUB_API_KEY,
    twelvedata: !!process.env.TWELVEDATA_API_KEY,
    alphavantage: !!process.env.ALPHAVANTAGE_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    betterAuthUrl: process.env.BETTER_AUTH_URL || 'not set',
    nextPublicBetterAuthUrl: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'not set',
    netlifyUrl: process.env.URL || process.env.DEPLOY_PRIME_URL || 'not set',
    computedAuthBaseUrl: getAuthBaseURL(),
    requestOrigin: request.headers.get('origin') || 'no origin header',
    requestHost: request.headers.get('host') || 'no host header',
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

