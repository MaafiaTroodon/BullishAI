import { NextRequest, NextResponse } from 'next/server'
import { normalizeToSymbol } from '@/lib/market/symbols'
import { fetchNews } from '@/lib/market/providers'
import { newsCache } from '@/lib/cache/lru'
import { setCORSHeaders } from '@/lib/http/cors'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  ticker: z.string().optional(),
  limit: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tickerParam = searchParams.get('ticker') || searchParams.get('symbol')
    const limitParam = searchParams.get('limit') || '5'

    const parseResult = schema.safeParse({ ticker: tickerParam, limit: limitParam })
    if (!parseResult.success || !tickerParam) {
      return setCORSHeaders(NextResponse.json(
        { ok: false, error: 'Missing ticker parameter' },
        { status: 400 }
      ))
    }

    // Normalize ticker
    const symbol = normalizeToSymbol(tickerParam)
    if (!symbol) {
      return setCORSHeaders(NextResponse.json(
        { ok: false, error: `Unknown ticker: ${tickerParam}` },
        { status: 400 }
      ))
    }

    const limit = parseInt(limitParam, 10) || 5
    const clampedLimit = Math.min(Math.max(limit, 1), 20)

    // Check cache
    const cacheKey = `news:${symbol}:${clampedLimit}`
    const cached = newsCache.get(cacheKey)
    if (cached) {
      return setCORSHeaders(NextResponse.json({ ok: true, data: cached }))
    }

    // Fetch news
    const news = await fetchNews(symbol, clampedLimit)

    // Cache it
    if (news.length > 0) {
      newsCache.set(cacheKey, news)
    }

    console.log(`News fetched for ${symbol}: ${news.length} items`)

    return setCORSHeaders(NextResponse.json({ ok: true, data: news }))
  } catch (error: any) {
    console.error('News API error:', error)
    return setCORSHeaders(NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch news' },
      { status: 200 }
    ))
  }
}

export async function OPTIONS() {
  return setCORSHeaders(new NextResponse(null, { status: 204 }))
}
