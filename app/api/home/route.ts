import { NextRequest, NextResponse } from 'next/server'
import { getFromCache, setCache } from '@/lib/providers/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const cacheKey = 'home:aggregate'
    const cached = getFromCache<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached.value, {
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
      })
    }

    const origin = req.nextUrl.origin
    const requests = await Promise.allSettled([
      fetch(`${origin}/api/home/movers`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`${origin}/api/home/top-picks`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`${origin}/api/home/best-value`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`${origin}/api/home/strongest-momentum`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`${origin}/api/home/strongest-today`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`${origin}/api/calendar/earnings?range=month`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`${origin}/api/calendar/dividends?range=month`, { cache: 'no-store' }).then((r) => r.json()),
    ])

    const [
      moversRes,
      topRes,
      valueRes,
      momentumRes,
      strongestRes,
      earningsRes,
      dividendsRes,
    ] = requests.map((r) => (r.status === 'fulfilled' ? r.value : null))

    const payload = {
      movers: moversRes || { gainers: [], losers: [] },
      picks: {
        top: topRes?.stocks || [],
        value: valueRes?.stocks || [],
        momentum: momentumRes?.stocks || [],
        strongestToday: strongestRes?.stocks || [],
      },
      earnings: earningsRes || { items: [] },
      dividends: dividendsRes || { items: [] },
      timestamp: new Date().toISOString(),
    }

    const picksEmpty =
      payload.picks.top.length === 0 &&
      payload.picks.value.length === 0 &&
      payload.picks.momentum.length === 0 &&
      payload.picks.strongestToday.length === 0

    if (!picksEmpty) {
      setCache(cacheKey, payload, 60 * 1000)
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error: any) {
    console.error('Home aggregate API error:', error)
    return NextResponse.json(
      { error: error.message || 'home_aggregate_error' },
      { status: 500 }
    )
  }
}
