import { NextRequest, NextResponse } from 'next/server'
import { normalizeToSymbol } from '@/lib/market/symbols'
import { fetchFundamentals } from '@/lib/market/providers'
import { fundamentalsCache } from '@/lib/cache/lru'
import { setCORSHeaders } from '@/lib/http/cors'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  ticker: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tickerParam = searchParams.get('ticker') || searchParams.get('symbol')

    const parseResult = schema.safeParse({ ticker: tickerParam })
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

    // Check cache
    const cacheKey = `fundamentals:${symbol}`
    const cached = fundamentalsCache.get(cacheKey)
    if (cached) {
      return setCORSHeaders(NextResponse.json({ ok: true, data: cached }))
    }

    // Fetch fundamentals
    const fundamentals = await fetchFundamentals(symbol)

    // Cache it
    fundamentalsCache.set(cacheKey, fundamentals)

    console.log(`Fundamentals fetched for ${symbol} from ${fundamentals.source}`)

    return setCORSHeaders(NextResponse.json({ ok: true, data: fundamentals }))
  } catch (error: any) {
    console.error('Fundamentals API error:', error)
    return setCORSHeaders(NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch fundamentals' },
      { status: 200 }
    ))
  }
}

export async function OPTIONS() {
  return setCORSHeaders(new NextResponse(null, { status: 204 }))
}

