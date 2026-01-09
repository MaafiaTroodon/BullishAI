import { NextRequest, NextResponse } from 'next/server'
import { getFromCache, setCache } from '@/lib/providers/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function rangeToDates(range: string) {
  const start = new Date()
  const end = new Date()
  if (range === 'today') {
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  } else if (range === 'week') {
    end.setDate(end.getDate() + 7)
  } else {
    end.setDate(end.getDate() + 30)
  }
  return {
    from: start.toISOString().split('T')[0],
    to: end.toISOString().split('T')[0],
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const tab = (url.searchParams.get('tab') || 'earnings').toLowerCase()
    const range = url.searchParams.get('range') || 'week'
    const fromParam = url.searchParams.get('from')
    const toParam = url.searchParams.get('to')

    const cacheKey = `calendar:${tab}:${range}:${fromParam || 'auto'}:${toParam || 'auto'}`
    const cached = getFromCache<any>(cacheKey)
    if (cached && !cached.isStale) {
      return NextResponse.json(cached.value, {
        headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' },
      })
    }

    let data: any = null
    if (tab === 'dividends') {
      const res = await fetch(`${req.nextUrl.origin}/api/calendar/dividends?range=${range}`, { cache: 'no-store' })
      data = await res.json().catch(() => ({ items: [] }))
    } else if (tab === 'macro') {
      const { from, to } = fromParam && toParam ? { from: fromParam, to: toParam } : rangeToDates(range)
      const res = await fetch(`${req.nextUrl.origin}/api/calendar/macro?from=${from}&to=${to}`, { cache: 'no-store' })
      data = await res.json().catch(() => ({ items: [] }))
    } else {
      const { from, to } = fromParam && toParam ? { from: fromParam, to: toParam } : rangeToDates(range)
      const res = await fetch(`${req.nextUrl.origin}/api/calendar/earnings?from=${from}&to=${to}`, { cache: 'no-store' })
      data = await res.json().catch(() => ({ items: [] }))
    }

    const payload = {
      tab,
      range,
      ...data,
    }
    setCache(cacheKey, payload, 30 * 60 * 1000)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch (error: any) {
    console.error('Calendar aggregator API error:', error)
    return NextResponse.json(
      { error: error.message || 'calendar_aggregator_error', items: [] },
      { status: 500 }
    )
  }
}
