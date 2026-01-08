import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type QuoteEntry = {
  symbol: string
  data?: {
    price?: number
    dp?: number
    changePercent?: number
    high?: number
    low?: number
  }
}

type CacheEntry = {
  ts: number
  data: any
}

const CACHE_TTL_MS = 45_000
const cache = new Map<string, CacheEntry>()

const US_BASKET = [
  'AAPL','MSFT','GOOGL','AMZN','META','NVDA','TSLA','JPM','V','MA','XOM','CVX','JNJ','UNH','PG','HD','COST','AVGO','LLY','BAC','NFLX'
]
const NASDAQ_BASKET = [
  'AAPL','MSFT','NVDA','AMZN','META','GOOGL','AVGO','TSLA','NFLX','COST','AMD','ADBE'
]
const DOW_BASKET = [
  'UNH','JPM','HD','GS','BA','CAT','MCD','KO','V','AXP','IBM','CVX'
]
const CA_BASKET = [
  'RY.TO','TD.TO','BMO.TO','BNS.TO','ENB.TO','CNQ.TO','SU.TO','SHOP.TO','CP.TO','CNR.TO','BCE.TO','TRI.TO','ATD.TO','MFC.TO','POW.TO'
]

const US_SECTOR_MAP: Record<string, string> = {
  AAPL: 'Technology',
  MSFT: 'Technology',
  NVDA: 'Technology',
  AVGO: 'Technology',
  AMD: 'Technology',
  ADBE: 'Technology',
  AMZN: 'Consumer Discretionary',
  TSLA: 'Consumer Discretionary',
  HD: 'Consumer Discretionary',
  COST: 'Consumer Staples',
  PG: 'Consumer Staples',
  META: 'Communication Services',
  GOOGL: 'Communication Services',
  NFLX: 'Communication Services',
  JPM: 'Financials',
  V: 'Financials',
  MA: 'Financials',
  BAC: 'Financials',
  XOM: 'Energy',
  CVX: 'Energy',
  JNJ: 'Healthcare',
  UNH: 'Healthcare',
}

const CA_SECTOR_MAP: Record<string, string> = {
  'RY.TO': 'Financials',
  'TD.TO': 'Financials',
  'BMO.TO': 'Financials',
  'BNS.TO': 'Financials',
  'MFC.TO': 'Financials',
  'POW.TO': 'Financials',
  'ENB.TO': 'Energy',
  'CNQ.TO': 'Energy',
  'SU.TO': 'Energy',
  'CP.TO': 'Industrials',
  'CNR.TO': 'Industrials',
  'BCE.TO': 'Communication Services',
  'TRI.TO': 'Technology',
  'SHOP.TO': 'Technology',
  'ATD.TO': 'Consumer Staples',
}

const INDEX_DEFS = [
  { label: 'S&P 500', symbol: 'SPY', basket: US_BASKET },
  { label: 'Nasdaq', symbol: 'QQQ', basket: NASDAQ_BASKET },
  { label: 'Dow', symbol: 'DIA', basket: DOW_BASKET },
  { label: 'TSX', symbol: 'XIU.TO', basket: CA_BASKET },
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function normalizeQuotes(quotes: QuoteEntry[]) {
  const map = new Map<string, QuoteEntry['data']>()
  quotes.forEach((q) => {
    if (!q.symbol) return
    map.set(q.symbol.toUpperCase(), q.data || {})
  })
  return map
}

function computeBreadth(quotes: QuoteEntry['data'][]) {
  const changes = quotes
    .map((q) => Number(q?.dp ?? q?.changePercent ?? 0))
    .filter((v) => Number.isFinite(v))
  if (changes.length === 0) {
    return { advancing: 0, declining: 0, breadthPct: 0, advDecRatio: 1 }
  }
  const advancing = changes.filter((c) => c > 0).length
  const declining = changes.filter((c) => c < 0).length
  const total = Math.max(changes.length, 1)
  return {
    advancing,
    declining,
    breadthPct: (advancing / total) * 100,
    advDecRatio: advancing / (declining || 1),
  }
}

function computeMomentum(quotes: QuoteEntry['data'][]) {
  const changes = quotes
    .map((q) => Number(q?.dp ?? q?.changePercent ?? 0))
    .filter((v) => Number.isFinite(v))
  if (changes.length === 0) return 0
  return changes.reduce((sum, v) => sum + v, 0) / changes.length
}

function computeVolatility(quotes: QuoteEntry['data'][]) {
  const ranges = quotes
    .map((q) => {
      const price = Number(q?.price || 0)
      const high = Number(q?.high || 0)
      const low = Number(q?.low || 0)
      if (price > 0 && high > 0 && low > 0) {
        return ((high - low) / price) * 100
      }
      const change = Number(q.dp ?? q.changePercent ?? 0)
      return Math.abs(change) * 0.7
    })
    .filter((v) => Number.isFinite(v))
  if (ranges.length === 0) return 0
  return ranges.reduce((sum, v) => sum + v, 0) / ranges.length
}

function computePulse(breadth: ReturnType<typeof computeBreadth>, momentumAvg: number, volatilityProxy: number) {
  const breadthScore = (breadth.advancing - breadth.declining) / Math.max(breadth.advancing + breadth.declining, 1)
  const momentumScore = clamp(momentumAvg / 2, -1, 1)
  const volatilityScore = clamp(volatilityProxy / 3, 0, 1)
  let score = 50 + breadthScore * 25 + momentumScore * 20 - volatilityScore * 15
  if (volatilityScore > 0.8 && breadthScore < 0) score -= 5
  score = clamp(score, 0, 100)
  const label = score >= 60 ? 'Bullish' : score <= 40 ? 'Risk-Off' : 'Neutral'
  return { score: Math.round(score), label }
}

function computeConfidence(label: string, indexMomentum: number, breadthScore: number, volatilityProxy: number) {
  const breadthComponent = clamp(breadthScore, -1, 1) * 12
  const momentumComponent = clamp(indexMomentum, -6, 6) * 1
  const volatilityComponent = clamp(volatilityProxy / 3, 0, 1) * -8
  let score = 50 + momentumComponent + breadthComponent + volatilityComponent
  if (label === 'Bullish') score += 3
  if (label === 'Risk-Off') score -= 3
  score = clamp(score, 0, 100)
  const state = score >= 60 ? 'Bullish' : score <= 39 ? 'Risk-Off' : 'Neutral'
  return { score: Math.round(score), state }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const market = (searchParams.get('market') || 'US').toUpperCase()
  const cacheKey = `signals-${market}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data)
  }

  const basket = market === 'CA' ? CA_BASKET : US_BASKET
  const symbols = Array.from(new Set([...basket, ...INDEX_DEFS.map((i) => i.symbol)]))
  const quoteRes = await fetch(`${req.nextUrl.origin}/api/quotes?symbols=${symbols.join(',')}`, { cache: 'no-store' })
  const quoteJson = await quoteRes.json().catch(() => ({ quotes: [] }))
  const quoteMap = normalizeQuotes(quoteJson.quotes || [])

  const basketQuotes = basket.map((symbol) => quoteMap.get(symbol)).filter(Boolean) as QuoteEntry['data'][]
  const breadth = computeBreadth(basketQuotes)
  const momentumAvg = computeMomentum(basketQuotes)
  const volatilityProxy = computeVolatility(basketQuotes)
  const pulse = computePulse(breadth, momentumAvg, volatilityProxy)

  const confidence = INDEX_DEFS.map((indexDef) => {
    const indexQuote = quoteMap.get(indexDef.symbol)
    const indexMomentum = Number(indexQuote?.dp ?? indexQuote?.changePercent ?? 0)
    const indexBasketQuotes = indexDef.basket
      .map((symbol) => quoteMap.get(symbol))
      .filter(Boolean) as QuoteEntry['data'][]
    const indexBreadth = computeBreadth(indexBasketQuotes)
    const indexVolatility = computeVolatility(indexBasketQuotes)
    const { score, state } = computeConfidence(pulse.label, indexMomentum, (indexBreadth.advancing - indexBreadth.declining) / Math.max(indexBreadth.advancing + indexBreadth.declining, 1), indexVolatility || volatilityProxy)

    return {
      label: indexDef.label,
      symbol: indexDef.symbol,
      score,
      state,
      disclaimer: 'Estimate based on live market signals.',
    }
  })

  let sectors: Array<{ name: string; changePercent: number; strength: number }> = []
  if (market === 'US') {
    try {
      const sectorRes = await fetch(`${req.nextUrl.origin}/api/market/sector-momentum`, { cache: 'no-store' })
      const sectorJson = await sectorRes.json().catch(() => ({ sectors: [] }))
      sectors = (sectorJson.sectors || []).map((s: any) => ({
        name: s.name,
        changePercent: Number(s.changePercent || 0),
        strength: Math.abs(Number(s.changePercent || 0)),
      }))
    } catch {}
  }

  if (sectors.length === 0) {
    const sectorMap = market === 'CA' ? CA_SECTOR_MAP : US_SECTOR_MAP
    const sectorBuckets: Record<string, number[]> = {}
    Object.entries(sectorMap).forEach(([symbol, sector]) => {
      const quote = quoteMap.get(symbol)
      const change = Number(quote?.dp ?? quote?.changePercent ?? 0)
      if (!Number.isFinite(change)) return
      if (!sectorBuckets[sector]) sectorBuckets[sector] = []
      sectorBuckets[sector].push(change)
    })
    sectors = Object.entries(sectorBuckets).map(([name, changes]) => {
      const avg = changes.length ? changes.reduce((sum, v) => sum + v, 0) / changes.length : 0
      return { name, changePercent: avg, strength: Math.abs(avg) }
    })
  }

  sectors.sort((a, b) => b.strength - a.strength)
  sectors = sectors.slice(0, 8)

  // Fallback: if all sector changes are zero, approximate with top movers + sector map
  if (sectors.length > 0 && sectors.every((s) => Math.abs(s.changePercent) < 0.01)) {
    try {
      const moversRes = await fetch(`${req.nextUrl.origin}/api/market/top-movers?limit=20`, { cache: 'no-store' })
      const moversJson = await moversRes.json().catch(() => ({ movers: [] }))
      const movers = moversJson.movers || []
      const sectorMap = market === 'CA' ? CA_SECTOR_MAP : US_SECTOR_MAP
      const sectorBuckets: Record<string, number[]> = {}
      movers.forEach((m: any) => {
        const symbol = String(m.symbol || '').toUpperCase()
        const sector = sectorMap[symbol]
        if (!sector) return
        const change = Number(m.changePercent || 0)
        if (!Number.isFinite(change)) return
        if (!sectorBuckets[sector]) sectorBuckets[sector] = []
        sectorBuckets[sector].push(change)
      })
      const derived = Object.entries(sectorBuckets).map(([name, changes]) => {
        const avg = changes.length ? changes.reduce((sum, v) => sum + v, 0) / changes.length : 0
        return { name, changePercent: avg, strength: Math.abs(avg) }
      })
      if (derived.length > 0) {
        derived.sort((a, b) => b.strength - a.strength)
        sectors = derived.slice(0, 8)
      }
    } catch (error: any) {
      console.warn('[signals] sector fallback failed:', error?.message || error)
    }
  }

  // Ensure core sectors are represented with real signals when possible
  const requiredSectors = market === 'CA'
    ? ['Financials', 'Energy', 'Industrials', 'Consumer Staples', 'Communication Services']
    : ['Technology', 'Healthcare', 'Financials', 'Consumer Discretionary', 'Communication Services', 'Energy', 'Industrials', 'Consumer Staples']
  const sectorMap = market === 'CA' ? CA_SECTOR_MAP : US_SECTOR_MAP
  const existingSectorNames = new Set(sectors.map((s) => s.name))
  requiredSectors.forEach((name) => {
    if (existingSectorNames.has(name)) return
    const symbolEntries = Object.entries(sectorMap).filter(([, sector]) => sector === name)
    const changes = symbolEntries
      .map(([symbol]) => {
        const quote = quoteMap.get(symbol)
        return Number(quote?.dp ?? quote?.changePercent ?? 0)
      })
      .filter((v) => Number.isFinite(v))
    const avg = changes.length ? changes.reduce((sum, v) => sum + v, 0) / changes.length : momentumAvg
    sectors.push({ name, changePercent: avg, strength: Math.abs(avg) })
  })

  sectors.sort((a, b) => b.strength - a.strength)
  sectors = sectors.slice(0, 8)

  const payload = {
    market,
    pulse: {
      score: pulse.score,
      label: pulse.label,
      updatedAt: new Date().toISOString(),
      components: {
        breadthPct: breadth.breadthPct,
        advDecRatio: breadth.advDecRatio,
        volatilityProxy,
        momentumAvg,
      },
    },
    confidence,
    sectors,
    updatedAt: Date.now(),
  }

  cache.set(cacheKey, { ts: Date.now(), data: payload })
  return NextResponse.json(payload)
}
