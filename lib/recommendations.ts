type RecommendationState = {
  searchHistory: string[]
  searchCount: number
  recommendationPool: string[]
}

const ROTATE_EVERY = 10
const MAX_HISTORY = 20

const GROUPS = [
  {
    title: 'Canadian banks & insurers',
    tickers: ['RY.TO', 'TD.TO', 'BMO.TO', 'BNS.TO', 'CM.TO', 'MFC.TO'],
    region: 'CA',
  },
  {
    title: 'US money-center banks',
    tickers: ['JPM', 'BAC', 'WFC', 'C', 'GS'],
    region: 'US',
  },
  {
    title: 'AI & mega-cap tech',
    tickers: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'AMD'],
    region: 'US',
  },
  {
    title: 'Platform & consumer tech',
    tickers: ['GOOGL', 'META', 'AMZN', 'NFLX', 'TSLA'],
    region: 'US',
  },
  {
    title: 'Defensive large caps',
    tickers: ['JNJ', 'PG', 'COST', 'UNH', 'KO'],
    region: 'US',
  },
]

const FALLBACK_US = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'AMD', 'JPM']
const FALLBACK_CA = ['RY.TO', 'TD.TO', 'BMO.TO', 'BNS.TO', 'CM.TO', 'MFC.TO', 'ENB.TO', 'SU.TO']

const normalizeTicker = (ticker: string) => ticker.trim().toUpperCase()
export const canonicalizeTicker = (ticker: string) => {
  const upper = normalizeTicker(ticker)
  const canadianBase = ['RY', 'TD', 'BMO', 'BNS', 'CM', 'MFC', 'NA']
  if (!upper.endsWith('.TO') && canadianBase.includes(upper)) {
    return `${upper}.TO`
  }
  return upper
}
const uniq = (arr: string[]) => Array.from(new Set(arr))

const loadState = (): RecommendationState => {
  if (typeof window === 'undefined') {
    return { searchHistory: [], searchCount: 0, recommendationPool: [] }
  }
  try {
    const historyRaw = localStorage.getItem('searchHistory')
    const countRaw = localStorage.getItem('searchCount')
    const poolRaw = localStorage.getItem('recommendationPool')
    const searchHistory = historyRaw ? (JSON.parse(historyRaw) as string[]) : []
    const recommendationPool = poolRaw ? (JSON.parse(poolRaw) as string[]) : []
    const searchCount = countRaw ? Number(countRaw) : 0
    return {
      searchHistory: Array.isArray(searchHistory) ? uniq(searchHistory.map(canonicalizeTicker)) : [],
      searchCount: Number.isFinite(searchCount) ? searchCount : 0,
      recommendationPool: Array.isArray(recommendationPool) ? recommendationPool.map(canonicalizeTicker) : [],
    }
  } catch {
    return { searchHistory: [], searchCount: 0, recommendationPool: [] }
  }
}

const saveState = (state: RecommendationState) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('searchHistory', JSON.stringify(state.searchHistory))
    localStorage.setItem('searchCount', JSON.stringify(state.searchCount))
    localStorage.setItem('recommendationPool', JSON.stringify(state.recommendationPool))
  } catch {}
}

const pickGroupForTicker = (ticker: string) => {
  const upper = canonicalizeTicker(ticker)
  return GROUPS.find((group) => group.tickers.includes(upper))
}

const pickRelatedTickers = (seed: string, existing: string[], limit: number) => {
  const group = pickGroupForTicker(seed)
  const candidateList = group ? group.tickers : []
  const filtered = candidateList.filter((ticker) => ticker !== seed && !existing.includes(ticker))
  return filtered.slice(0, limit)
}

const desiredCountForSearches = (count: number) => {
  if (count <= 3) return 5
  if (count <= 6) return 8
  return 10
}

const buildFreshRecommendations = (seed: string, history: string[], desiredCount: number) => {
  const pool: string[] = []
  const combinedSeeds = uniq([seed, ...history]).slice(0, 3)
  combinedSeeds.forEach((ticker) => {
    pool.push(...pickRelatedTickers(ticker, pool, 3))
  })
  const canonicalSeed = canonicalizeTicker(seed)
  const isCanadian = canonicalSeed.endsWith('.TO') || ['BMO', 'TD', 'BNS', 'RY', 'CM', 'NA'].includes(seed)
  const fallback = isCanadian ? FALLBACK_CA : FALLBACK_US
  pool.push(...fallback.filter((ticker) => !pool.includes(ticker) && !combinedSeeds.includes(ticker)))
  return uniq(pool).slice(0, desiredCount)
}

const nudgeRecommendations = (prevPool: string[], seed: string, desiredCount: number) => {
  const cleaned = prevPool.filter((ticker) => ticker !== seed)
  const additions = pickRelatedTickers(seed, cleaned, 2)
  const nudged = uniq([...additions, ...cleaned])
  if (nudged.length >= desiredCount) return nudged.slice(0, desiredCount)
  const canonicalSeed = canonicalizeTicker(seed)
  const isCanadian = canonicalSeed.endsWith('.TO') || ['BMO', 'TD', 'BNS', 'RY', 'CM', 'NA'].includes(seed)
  const fallback = isCanadian ? FALLBACK_CA : FALLBACK_US
  const fill = fallback.filter((ticker) => !nudged.includes(ticker) && ticker !== seed)
  return uniq([...nudged, ...fill]).slice(0, desiredCount)
}

export const recordSearchTicker = (newTickerRaw: string) => {
  const newTicker = canonicalizeTicker(newTickerRaw)
  const state = loadState()
  const searchCount = state.searchCount + 1
  const searchHistory = uniq([newTicker, ...state.searchHistory.filter((t) => t !== newTicker)]).slice(0, MAX_HISTORY)
  const desiredCount = desiredCountForSearches(searchCount)
  const isCanadian = newTicker.endsWith('.TO') || ['BMO', 'TD', 'BNS', 'RY', 'CM', 'NA'].includes(newTicker)
  const poolHasCanada = state.recommendationPool.some((t) => t.endsWith('.TO'))
  const poolHasUS = state.recommendationPool.some((t) => !t.endsWith('.TO'))
  const regionSwitch = (isCanadian && !poolHasCanada) || (!isCanadian && !poolHasUS)
  const isBigRotate = searchCount % ROTATE_EVERY === 0 || state.recommendationPool.length === 0 || regionSwitch
  const recommendationPool = isBigRotate
    ? buildFreshRecommendations(newTicker, searchHistory, desiredCount)
    : nudgeRecommendations(state.recommendationPool, newTicker, desiredCount)
  const nextState = { searchHistory, searchCount, recommendationPool }
  saveState(nextState)
  return nextState
}

export const getRecommendationState = () => loadState()

export const groupRecommendations = (pool: string[]) => {
  const upper = pool.map(canonicalizeTicker)
  const grouped = GROUPS.map((group) => ({
    title: group.title,
    tickers: group.tickers.filter((ticker) => upper.includes(ticker)),
  })).filter((group) => group.tickers.length > 0)
  if (grouped.length) return grouped
  return [
    { title: 'Suggested tickers', tickers: upper.slice(0, 6) },
  ]
}
