import { NextRequest, NextResponse } from 'next/server'
import { parseSymbol } from '@/lib/market-symbol-parser'
import { getSession } from '@/lib/auth-server'

interface Recommendation {
  symbol: string
  name: string
  exchange: string
  score: number
  tags: string[]
  price: number
  chg1d: number
  volRel30: number
  summary: string
}

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50
const CACHE_SECONDS = 60

function normaliseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw || '', 10)
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_LIMIT
  return Math.min(parsed, MAX_LIMIT)
}

function computeScore(changePct: number, relVolume: number, rank: number): number {
  const base = Math.abs(changePct) * 10
  const volumeBoost = Math.max(relVolume - 1, 0) * 20
  const rankPenalty = rank * 1.5
  return Math.round(Math.max(0, Math.min(100, base + volumeBoost - rankPenalty)))
}

function deriveTags(changePct: number, relVolume: number, hasUpgradeNews: boolean): string[] {
  const tags: string[] = []
  if (hasUpgradeNews) tags.push('upgrade')
  if (changePct >= 3) tags.push('breakout')
  if (relVolume >= 1.5) tags.push('volume')
  if (tags.length === 0) tags.push('fundamentals')
  return Array.from(new Set(tags)).slice(0, 3)
}

function filterByUniverse(symbol: string, universe: string): boolean {
  if (universe === 'ALL') return true
  const parsed = parseSymbol(symbol)
  if (universe === 'US') {
    return parsed.exchange === 'NYSE' || parsed.exchange === 'NASDAQ'
  }
  if (universe === 'CA') {
    return parsed.exchange === 'TSX'
  }
  return true
}

export async function GET(req: NextRequest) {
  // Check authentication
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required. Please log in to use AI features.' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)
  const limit = normaliseLimit(searchParams.get('limit'))
  const offset = Number.parseInt(searchParams.get('offset') || '0', 10) || 0
  const universe = (searchParams.get('universe') || 'ALL').toUpperCase()
  const currency = (searchParams.get('currency') || 'NATIVE').toUpperCase()
  const exchanges = (searchParams.get('exchange') || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  const queryString = searchParams.get('q')?.trim().toUpperCase()
  const sort = searchParams.get('sort') || 'score_desc'

  try {
    const [moversRes, newsRes] = await Promise.all([
      fetch(`${req.nextUrl.origin}/api/market/top-movers?limit=${Math.min(limit * 2, 40)}`, {
        cache: 'no-store',
      }).catch(() => null),
      fetch(`${req.nextUrl.origin}/api/news/movers?limit=25`, {
        cache: 'no-store',
      }).catch(() => null),
    ])

    const moversJson = moversRes ? await moversRes.json().catch(() => ({ movers: [] })) : { movers: [] }
    const newsJson = newsRes ? await newsRes.json().catch(() => ({ items: [] })) : { items: [] }

    const upgradeSymbols = new Set<string>()
    ;(newsJson.items || []).forEach((item: any) => {
      const headline = `${item?.headline || item?.title || ''}`.toLowerCase()
      const tickers: string[] = Array.isArray(item?.tickers) ? item.tickers : []
      if (headline.includes('upgrade') || headline.includes('raises rating') || headline.includes('initiated')) {
        tickers.forEach((ticker) => upgradeSymbols.add(ticker?.toUpperCase()))
      }
    })

    const recommendations: Recommendation[] = (moversJson.movers || [])
      .map((m: any, idx: number) => {
        const symbol = (m.symbol || '').toUpperCase()
        if (!symbol) return null

        const parsed = parseSymbol(symbol)
        const price = Number.parseFloat(m.price ?? m.last ?? 0) || 0
        const changePct = Number.parseFloat(m.changePercent ?? m.change_pct ?? m.chg1d ?? 0) || 0
        const volume = Number.parseFloat(m.volume ?? m.vol ?? 0) || 0
        const relVolumeRaw = Number.parseFloat(m.relativeVolume ?? m.volRel30 ?? 0)
        const relVolume =
          !Number.isNaN(relVolumeRaw) && relVolumeRaw > 0
            ? relVolumeRaw
            : volume > 0
            ? Math.min(5, Math.max(0.5, volume / 1_000_000))
            : 1

        const tags = deriveTags(changePct, relVolume, upgradeSymbols.has(symbol))
        return {
          symbol,
          name: m.name || m.companyName || symbol,
          exchange: parsed.exchange,
          price,
          chg1d: Number.parseFloat(changePct.toFixed(2)),
          volRel30: Number.parseFloat(relVolume.toFixed(2)),
          score: computeScore(changePct, relVolume, idx),
          tags,
          summary: `${symbol} showing ${tags.join(', ')} with ${changePct.toFixed(2)}% move.`,
        }
      })
      .filter((rec: Recommendation | null): rec is Recommendation => !!rec && rec.price > 0)
      .filter((rec) => filterByUniverse(rec.symbol, universe))
      .filter((rec) => {
        if (exchanges.length === 0) return true
        return exchanges.includes(rec.exchange) || exchanges.includes(`X${rec.exchange.slice(0, 1)}${rec.exchange.slice(1)}`)
      })
      .filter((rec) => {
        if (!queryString) return true
        return rec.symbol.includes(queryString) || rec.name.toUpperCase().includes(queryString)
      })

    const sorted = recommendations.sort((a, b) => {
      switch (sort) {
        case 'yield_desc':
        case 'score_desc':
          return b.score - a.score
        case 'momentum_desc':
          return b.chg1d - a.chg1d
        default:
          return b.score - a.score
      }
    })

    const sliced = sorted.slice(offset, offset + limit)

    const responseBody = {
      success: true,
      data: sliced,
      error: null,
      meta: {
        count: sliced.length,
        limit,
        offset,
        asOf: new Date().toISOString(),
        universe,
        currency,
      },
    }

    return new NextResponse(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `s-maxage=${CACHE_SECONDS}`,
      },
    })
  } catch (error: any) {
    console.error('Recommended stocks error:', error)
    return NextResponse.json(
      {
        success: false,
        data: [],
        error: {
          code: 'RECOMMENDED_FETCH_FAILED',
          message: error?.message || 'Failed to generate recommendations',
        },
        meta: {
          count: 0,
          limit,
          offset,
          asOf: new Date().toISOString(),
          universe,
          currency,
        },
      },
      { status: 500 }
    )
  }
}

