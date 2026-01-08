import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch, buildCacheKey } from '@/lib/finnhub-client'
import { routeAIQuery } from '@/lib/ai-router'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const aiCache = new Map<string, { expires: number; data: any }>()

function classifyCatalyst(text: string) {
  const lower = text.toLowerCase()
  if (lower.includes('earnings') || lower.includes('eps') || lower.includes('guidance')) return 'earnings'
  if (lower.includes('upgrade') || lower.includes('downgrade') || lower.includes('price target')) return 'analyst'
  if (lower.includes('lawsuit') || lower.includes('investigation') || lower.includes('settlement')) return 'legal'
  if (lower.includes('acquisition') || lower.includes('merger') || lower.includes('buyout')) return 'm&a'
  if (lower.includes('macro') || lower.includes('inflation') || lower.includes('rates')) return 'macro'
  if (lower.includes('product') || lower.includes('launch') || lower.includes('partnership')) return 'product'
  return 'general'
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol: rawSymbol } = await params
    const symbol = rawSymbol.toUpperCase()
    const cacheKey = buildCacheKey('why-move', { symbol, day: new Date().toISOString().split('T')[0] })
    const cached = aiCache.get(cacheKey)
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1200' },
      })
    }

    const now = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 7)
    const fromStr = from.toISOString().split('T')[0]
    const toStr = now.toISOString().split('T')[0]

    const [newsRes, pressRes, sentimentRes, upgradesRes] = await Promise.all([
      finnhubFetch('company-news', { symbol, from: fromStr, to: toStr }, { cacheSeconds: 600 }),
      finnhubFetch('press-releases', { symbol, from: fromStr, to: toStr }, { cacheSeconds: 600 }),
      finnhubFetch('news-sentiment', { symbol }, { cacheSeconds: 600 }),
      finnhubFetch('stock/upgrade-downgrade', { symbol }, { cacheSeconds: 600 }),
    ])

    const news = Array.isArray(newsRes.data) ? newsRes.data : []
    const press = Array.isArray(pressRes.data) ? pressRes.data : []
    const upgrades = Array.isArray(upgradesRes.data) ? upgradesRes.data : []
    const sentiment = sentimentRes.data || {}

    const combined = [...press, ...news].slice(0, 8)
    const topHeadline = combined.find((item) => item.headline) || null
    const catalyst = topHeadline ? classifyCatalyst(topHeadline.headline) : 'general'

    const prompt = `Explain why ${symbol} moved recently using the provided headlines and sentiment.
Return exactly three bullet points with these labels:
1) What happened
2) Why it matters
3) What to watch next

Use only the supplied data.`

    const context = {
      symbol,
      news: combined.map((item) => ({
        headline: item.headline,
        summary: item.summary,
        source: item.source,
        datetime: item.datetime,
      })),
      metadata: {
        sentiment,
        upgrades: upgrades.slice(0, 5),
      },
    }

    const ai = await routeAIQuery(prompt, context as any, undefined, undefined, 'groq-llama', { forceGroqPrimaryFirst: true })

    const response = {
      symbol,
      catalyst,
      bullets: ai.answer,
      headlines: combined.slice(0, 3).map((item) => ({
        headline: item.headline,
        source: item.source,
        datetime: item.datetime,
      })),
      sentiment,
    }

    aiCache.set(cacheKey, { expires: Date.now() + 15 * 60 * 1000, data: response })

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1200' },
    })
  } catch (error: any) {
    console.error('Why-move error:', error)
    return NextResponse.json(
      { error: error.message || 'why_move_error' },
      { status: 500 }
    )
  }
}
