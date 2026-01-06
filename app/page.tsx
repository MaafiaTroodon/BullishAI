'use client'

import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, Brain, Bell, Search, BarChart3, Shield, Zap, Menu, User, LogOut, Settings, ChevronDown } from 'lucide-react'
import { InlineAIChat } from '@/components/InlineAIChat'
import { PopularToday } from '@/components/PopularToday'
import { TradingViewHeatmap } from '@/components/TradingViewHeatmap'
import TradingViewAdvancedChart from '@/components/TradingViewAdvancedChart'
import TradingViewTopStories from '@/components/TradingViewTopStories'
import { HeadlineRotator } from '@/components/HeadlineRotator'
import { TiltCard } from '@/components/TiltCard'
import TradingViewTickerTape from '@/components/TradingViewTickerTape'
import TradingViewMiniChart from '@/components/TradingViewMiniChart'
import useSWR from 'swr'
import { Reveal } from '@/components/anim/Reveal'
import { StaggerGrid } from '@/components/anim/StaggerGrid'
import { ParallaxImage } from '@/components/anim/ParallaxImage'
import { Footer } from '@/components/Footer'
import { authClient } from '@/lib/auth-client'
import { canonicalizeTicker, getRecommendationState, groupRecommendations, recordSearchTicker } from '@/lib/recommendations'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    const text = await res.text()
    console.error('Non-JSON response:', text.substring(0, 200))
    throw new Error('Invalid response format')
  }
  return res.json()
}

const US_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
const CANADIAN_STOCKS = ['CLS.TO', 'BMO.TO', 'TD.TO', 'DOL.TO', 'L.TO'] // Celestica, BMO, TD, Dollarama, Loblaw
const GOOD_DIVIDEND_TICKERS = [
  'AAPL', 'MSFT', 'JNJ', 'PG', 'KO', 'PEP', 'COST', 'UNH', 'XOM', 'CVX', 'JPM', 'BAC', 'WFC', 'V', 'MA',
  'SPY', 'VYM', 'SCHD', 'DVY',
  'RY.TO', 'TD.TO', 'BMO.TO', 'BNS.TO', 'CM.TO', 'MFC.TO', 'ENB.TO', 'SU.TO', 'TRP.TO',
]

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExchange, setSelectedExchange] = useState<'USA' | 'CAN'>('USA')
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [focusSymbol, setFocusSymbol] = useState<string | undefined>(undefined)
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [searchCount, setSearchCount] = useState(0)
  const [recommendationPool, setRecommendationPool] = useState<string[]>([])
  const [pricesByTicker, setPricesByTicker] = useState<Record<string, number>>({})
  const [hoveredSector, setHoveredSector] = useState<string | null>(null)
  
  // Get current stock list based on exchange
  const currentStocks = selectedExchange === 'USA' ? US_STOCKS : CANADIAN_STOCKS
  
  // Update selected symbol when exchange changes
  useEffect(() => {
    if (selectedExchange === 'USA') {
      setSelectedSymbol('AAPL')
    } else {
      setSelectedSymbol('CLS.TO')
    }
  }, [selectedExchange])
  
  // Use actual auth session instead of localStorage
  // Add timeout and error handling to prevent infinite loading
  const { data: session, isPending: sessionLoading, error: sessionError } = authClient.useSession()
  const isLoggedIn = !!session?.user
  
  // If session check fails, don't block the page - just assume not logged in
  if (sessionError) {
    console.warn('Session check failed:', sessionError)
  }

  // Check URL for focusSymbol parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const symbol = params.get('focusSymbol')
      if (symbol) {
        setFocusSymbol(symbol.toUpperCase())
        // Clean up URL
        window.history.replaceState({}, '', '/')
      }
    }
  }, [])

  // Always start at the top of the homepage on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  }, [])

  // Load recently viewed tickers (for "Because you viewed..." widget)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('recentlyViewedTickers')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setRecentlyViewed(parsed.map((t) => canonicalizeTicker(String(t))))
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const refresh = () => {
      const state = getRecommendationState()
      setSearchHistory(state.searchHistory)
      setSearchCount(state.searchCount)
      setRecommendationPool(state.recommendationPool)
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  const recordViewedTicker = (symbol: string) => {
    if (typeof window === 'undefined') return
    try {
      const normalized = symbol.toUpperCase()
      const raw = localStorage.getItem('recentlyViewedTickers')
      const existing = raw ? JSON.parse(raw) : []
      const list = Array.isArray(existing) ? existing.map((t: string) => String(t).toUpperCase()) : []
      const canonical = canonicalizeTicker(normalized)
      const next = [canonical, ...list.filter((t: string) => canonicalizeTicker(t) !== canonical)].slice(0, 5)
      localStorage.setItem('recentlyViewedTickers', JSON.stringify(next))
      setRecentlyViewed(next)
    } catch {}
  }

  const recordSearch = (symbol: string) => {
    const state = recordSearchTicker(symbol)
    setSearchHistory(state.searchHistory)
    setSearchCount(state.searchCount)
    setRecommendationPool(state.recommendationPool)
  }

  useEffect(() => {
    if (!recommendationPool.length) return
    let active = true
    const tickers = recommendationPool
    const interval = setInterval(async () => {
      try {
        const data = await fetcher(`/api/quotes?symbols=${tickers.join(',')}`)
        const next: Record<string, number> = {}
        for (const quote of data?.quotes || []) {
          if (quote?.symbol && Number.isFinite(Number(quote?.price))) {
            next[String(quote.symbol).toUpperCase()] = Number(quote.price)
          }
        }
        if (active) {
          setPricesByTicker((prev) => ({ ...prev, ...next }))
        }
      } catch {}
    }, 1000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [recommendationPool])


  // Handle search with suggestions
  const handleSearchChange = async (value: string) => {
    setSearchQuery(value)
    if (value.length >= 2) {
      try {
        const response = await fetch(`/api/search?query=${encodeURIComponent(value)}`)
        const data = await response.json()
        if (data.results) {
          setSearchSuggestions(data.results)
          setShowSuggestions(true)
        }
      } catch (error) {
        console.error('Search error:', error)
      }
    } else {
      setShowSuggestions(false)
    }
  }

  // Normalize symbol for API calls (remove .TO for quote API, but keep for display)
  const apiSymbol = selectedSymbol.includes('.TO') 
    ? selectedSymbol.replace('.TO', '') 
    : selectedSymbol

  const { data: topQuotes } = useSWR(
    `/api/quote?symbol=${apiSymbol}`,
    fetcher,
    { refreshInterval: 15000 }
  )

  const { data: chartData } = useSWR(
    `/api/chart?symbol=${apiSymbol}&range=1d`,
    fetcher
  )

  const marketCode = selectedExchange === 'CAN' ? 'CA' : 'US'
  const { data: signalsData } = useSWR(
    `/api/market/signals?market=${marketCode}`,
    fetcher,
    { refreshInterval: 30000 }
  )
  const { data: radarData } = useSWR(
    `/api/market/radar?market=${marketCode}`,
    fetcher,
    { refreshInterval: 15000 }
  )
  const { data: weatherData } = useSWR(
    `/api/market/weather?market=${marketCode}`,
    fetcher,
    { refreshInterval: 180000 }
  )
  const { data: earningsData } = useSWR('/api/calendar/earnings?range=week', fetcher, { refreshInterval: 60000 })
  const dividendSymbols = useMemo(() => GOOD_DIVIDEND_TICKERS.join(','), [])
  const { data: dividendsData } = useSWR(
    !isLoggedIn ? `/api/calendar/dividends?range=month&symbols=${dividendSymbols}` : null,
    fetcher,
    { refreshInterval: 300000 }
  )
  const { data: dividendCandidates } = useSWR(
    !isLoggedIn ? `/api/market/dividend-candidates?symbols=${dividendSymbols}` : null,
    fetcher,
    { refreshInterval: 300000 }
  )
  const { data: dividendQuotes } = useSWR(
    !isLoggedIn ? `/api/quotes?symbols=${dividendSymbols}` : null,
    fetcher,
    { refreshInterval: 120000 }
  )
  const earningsSymbols = useMemo(() => {
    const items = earningsData?.items || []
    return Array.from(new Set(items.map((item: any) => String(item.symbol || '').toUpperCase()).filter(Boolean))).slice(0, 12)
  }, [earningsData])
  const { data: earningsInsights } = useSWR(
    earningsSymbols.length ? `/api/market/earnings-insights?symbols=${earningsSymbols.join(',')}` : null,
    fetcher,
    { refreshInterval: 90000 }
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery && searchQuery.length <= 5) {
      const symbol = searchQuery.toUpperCase()
      setSelectedSymbol(symbol)
      recordSearch(symbol)
      recordViewedTicker(symbol)
    }
  }

  const marketPulse = signalsData?.pulse || {
    score: 50,
    label: 'Neutral',
    updatedAt: new Date().toISOString(),
    components: {
      breadthPct: 0,
      advDecRatio: 1,
      volatilityProxy: 0,
      momentumAvg: 0,
    },
  }

  const confidenceBars = signalsData?.confidence || []
  const radarItems = radarData?.items || []
  const marketWeather = weatherData?.weather || {
    icon: '🌤️',
    headline: 'Mixed conditions',
    detail: 'Market signals are stabilizing across key sectors.',
  }

  const sectorWheel = signalsData?.sectors || []

  const sectorInfo: Record<string, { includes: string[]; why: string }> = {
    Technology: {
      includes: ['AAPL', 'MSFT', 'NVDA'],
      why: 'Growth engine and innovation proxy.',
    },
    Healthcare: {
      includes: ['UNH', 'JNJ', 'PFE'],
      why: 'Defensive demand with steady cash flows.',
    },
    Financials: {
      includes: ['JPM', 'BAC', 'GS'],
      why: 'Credit cycle and rate sensitivity.',
    },
    'Consumer Discretionary': {
      includes: ['AMZN', 'TSLA', 'HD'],
      why: 'Spending and confidence gauge.',
    },
    'Communication Services': {
      includes: ['META', 'GOOGL', 'NFLX'],
      why: 'Ad cycles + media trends; strong in bull markets.',
    },
    Energy: {
      includes: ['XOM', 'CVX', 'ENPH'],
      why: 'Inflation hedge; tied to commodities and geopolitics.',
    },
    Industrials: {
      includes: ['BA', 'LMT', 'CAT'],
      why: 'Economic growth signal and infrastructure proxy.',
    },
    'Consumer Staples': {
      includes: ['WMT', 'PG', 'KO'],
      why: 'Defensive sector; resilient in downturns.',
    },
    Utilities: {
      includes: ['NEE', 'DUK', 'SO'],
      why: 'Stable cash flows; defensive yield proxy.',
    },
    'Real Estate': {
      includes: ['PLD', 'AMT', 'O'],
      why: 'Rate-sensitive income and property cycle barometer.',
    },
    Materials: {
      includes: ['LIN', 'APD', 'FCX'],
      why: 'Commodity and manufacturing demand signal.',
    },
  }

  const sectorColorMap: Record<string, string> = {
    Technology: '#4f8bff',
    Healthcare: '#35c3a5',
    Financials: '#f2b84b',
    'Consumer Discretionary': '#ff7a7a',
    'Consumer Staples': '#9ad66f',
    'Communication Services': '#8f6bff',
    Energy: '#ff9a3d',
    Industrials: '#4fc1ff',
    Utilities: '#7cc0ff',
    'Real Estate': '#b68bff',
    Materials: '#ffb86b',
  }

  const rotationLabelForChange = (change: number) => {
    if (change >= 0.3) return { label: 'Rotating In', color: 'text-emerald-400', icon: '🟢' }
    if (change <= -0.3) return { label: 'Rotating Out', color: 'text-red-400', icon: '🔴' }
    return { label: 'Neutral', color: 'text-slate-400', icon: '🟡' }
  }

  const sectorSegments = useMemo(() => {
    if (!sectorWheel.length) return []
    const weights = sectorWheel.map((s: any) => {
      const raw = Math.abs(Number(s.changePercent ?? s.strength ?? 0))
      return raw > 0 ? raw : 0.3
    })
    const total = weights.reduce((sum, w) => sum + w, 0) || 1
    let angle = 0
    return sectorWheel.map((sector: any, idx: number) => {
      const value = weights[idx]
      const sweep = (value / total) * 360
      const start = angle
      const end = angle + sweep
      angle = end
      const change = Number(sector.changePercent ?? sector.strength ?? 0)
      return {
        name: sector.name,
        changePercent: change,
        startAngle: start,
        endAngle: end,
        color: sectorColorMap[sector.name] || `hsl(${210 + idx * 28}, 70%, 55%)`,
      }
    })
  }, [sectorWheel])

  const hoveredSectorDetails = hoveredSector ? sectorInfo[hoveredSector] : null
  const hoveredSectorData = hoveredSector
    ? sectorWheel.find((sector: any) => sector.name === hoveredSector)
    : null

  const moneyFlowSummary = useMemo(() => {
    if (!sectorWheel.length) return null
    const sorted = [...sectorWheel].sort((a: any, b: any) => Math.abs(b.changePercent ?? b.strength ?? 0) - Math.abs(a.changePercent ?? a.strength ?? 0))
    const gainers = sorted.filter((s: any) => (s.changePercent ?? s.strength ?? 0) > 0).slice(0, 2)
    const losers = sorted.filter((s: any) => (s.changePercent ?? s.strength ?? 0) < 0).slice(0, 2)
    const gainText = gainers.length ? gainers.map((s: any) => s.name).join(' & ') : 'Mixed'
    const lossText = losers.length ? losers.map((s: any) => s.name).join(' & ') : 'Stable'
    return { gainText, lossText }
  }, [sectorWheel])

  const earningsItems = useMemo(() => {
    const items = earningsData?.items || []
    if (items.length === 0) return []
    const filtered = selectedExchange === 'CAN'
      ? items.filter((item: any) => String(item.symbol || '').toUpperCase().includes('.TO'))
      : items.filter((item: any) => !String(item.symbol || '').toUpperCase().includes('.TO'))
    const deduped = new Map<string, any>()
    filtered.forEach((item: any) => {
      const symbol = String(item.symbol || '').toUpperCase()
      const insights = earningsInsights?.items?.[symbol]
      if (!insights?.eligible) return
      const exchange = insights?.exchange || (symbol.includes('.TO') ? 'TSX' : 'US')
      const key = `${symbol}-${exchange}`
      const existing = deduped.get(key)
      if (!existing) {
        deduped.set(key, item)
      } else if ((insights?.sampleCount || 0) > (earningsInsights?.items?.[String(existing.symbol || '').toUpperCase()]?.sampleCount || 0)) {
        deduped.set(key, item)
      }
    })
    return Array.from(deduped.values()).slice(0, 10)
  }, [earningsData, selectedExchange, earningsInsights])

  const upcomingDividends = useMemo(() => {
    const items = dividendsData?.items || []
    if (!items.length) return []
    const allowed = new Set(GOOD_DIVIDEND_TICKERS.map((t) => t.toUpperCase()))
    const marketCapMap = new Map<string, number>()
    for (const quote of dividendQuotes?.quotes || []) {
      if (quote?.symbol && Number.isFinite(Number(quote?.data?.marketCap))) {
        marketCapMap.set(String(quote.symbol).toUpperCase(), Number(quote.data.marketCap))
      }
    }
    const filtered = items.filter((item: any) => {
      const symbol = String(item.symbol || '').toUpperCase()
      const y = Number(item.yield || 0)
      const marketCap = marketCapMap.get(symbol)
      return allowed.has(symbol) && Number.isFinite(y) && y > 0 && marketCap !== undefined && marketCap >= 100_000_000_000
    })
    filtered.sort((a: any, b: any) => {
      const dateA = new Date(a.exDate || a.payDate || a.date || 0).getTime()
      const dateB = new Date(b.exDate || b.payDate || b.date || 0).getTime()
      return dateA - dateB
    })
    return filtered.slice(0, 8)
  }, [dividendsData])

  const formatCountdown = (dateString?: string, timeTag?: string) => {
    if (!dateString) return '—'
    const now = new Date()
    const base = new Date(dateString)
    if (Number.isNaN(base.getTime())) return '—'
    const tag = timeTag || 'BMO'
    const event = new Date(`${dateString}T${tag === 'AMC' ? '16:00:00' : '09:00:00'}`)
    const diffMs = event.getTime() - now.getTime()
    if (diffMs < 0) return '—'
    const diffHours = Math.round(diffMs / 36e5)
    if (diffHours <= 24) {
      return diffHours <= 6 ? `Today (${tag})` : `Tomorrow (${tag})`
    }
    const diffDays = Math.floor(diffHours / 24)
    const hoursRemainder = diffHours - diffDays * 24
    return `In ${diffDays}d ${hoursRemainder}h`
  }

  const earningsBiasLabel = (symbol: string) => {
    const insights = earningsInsights?.items?.[symbol]
    if (!insights?.eligible) return 'Limited data'
    const riskMeta = earningsRiskLabels.get(symbol)
    const change = Number(insights.changePercent ?? 0)
    if (riskMeta?.label === 'High Risk') {
      return change >= 0.5 ? 'High volatility setup' : 'Caution: uncertainty elevated'
    }
    if (riskMeta?.label === 'Low Risk') {
      return change >= 0 ? 'Stable setup' : 'Defensive posture'
    }
    return change >= 0.3 ? 'Mixed expectations' : 'Balanced expectations'
  }

  const earningsRiskLabels = useMemo(() => {
    if (earningsItems.length === 0) return new Map<string, { score: number | null; label: string }>()
    const scores = earningsItems.map((item: any) => {
      const symbol = String(item.symbol || '').toUpperCase()
      const metrics = earningsInsights?.items?.[symbol] || {}
      const typicalMove = Number(metrics.typicalMove ?? 0)
      const realizedVol = Number(metrics.realizedVol ?? 0)
      const hasData = Number.isFinite(typicalMove) && typicalMove > 0 || Number.isFinite(realizedVol) && realizedVol > 0
      if (!hasData) {
        return { symbol, score: null }
      }
      const normalizedTypical = Math.min(Math.abs(typicalMove) / 6, 1)
      const normalizedVol = Math.min(Math.abs(realizedVol) / 4, 1)
      let score = normalizedTypical * 45 + normalizedVol * 45
      if (marketPulse.label === 'Risk-Off') score += 6
      if (marketPulse.label === 'Bullish') score -= 3
      if (item.date) {
        const eventDate = new Date(item.date)
        const diffMs = eventDate.getTime() - Date.now()
        if (diffMs <= 86400000 && diffMs >= 0) score += 8
      }
      score = Math.max(0, Math.min(100, score))
      return { symbol, score }
    })
    const scored = scores.filter((s) => s.score !== null) as Array<{ symbol: string; score: number }>
    const map = new Map<string, { score: number | null; label: string }>()
    if (scored.length === 0) {
      scores.forEach((s) => map.set(s.symbol, { score: null, label: '—' }))
      return map
    }
    const mediumCount = scored.filter((s) => s.score >= 34 && s.score <= 66).length
    const useRanking = mediumCount / scored.length > 0.7
    if (useRanking) {
      const sorted = [...scored].sort((a, b) => b.score - a.score)
      const highCutoff = Math.max(1, Math.ceil(sorted.length * 0.2))
      const lowCutoff = Math.max(1, Math.floor(sorted.length * 0.2))
      sorted.forEach((s, idx) => {
        if (idx < highCutoff) {
          map.set(s.symbol, { score: s.score, label: 'High Risk' })
        } else if (idx >= sorted.length - lowCutoff) {
          map.set(s.symbol, { score: s.score, label: 'Low Risk' })
        } else {
          map.set(s.symbol, { score: s.score, label: 'Medium Risk' })
        }
      })
    } else {
      scored.forEach((s) => {
        const label = s.score >= 67 ? 'High Risk' : s.score >= 34 ? 'Medium Risk' : 'Low Risk'
        map.set(s.symbol, { score: s.score, label })
      })
    }
    scores.forEach((s) => {
      if (!map.has(s.symbol)) {
        map.set(s.symbol, { score: s.score, label: '—' })
      }
    })
    return map
  }, [earningsItems, earningsInsights, marketPulse.label])

  const upcomingEarnings = useMemo(() => {
    const items = earningsData?.items || []
    const now = new Date()
    const sevenDays = new Date(now)
    sevenDays.setDate(sevenDays.getDate() + 7)
    const filtered = items.filter((item: any) => {
      if (!item.date) return false
      const d = new Date(item.date)
      if (!(d >= now && d <= sevenDays)) return false
      const symbol = String(item.symbol || '').toUpperCase()
      const insights = earningsInsights?.items?.[symbol]
      if (!insights?.eligible) return false
      const riskMeta = earningsRiskLabels.get(symbol)
      return riskMeta && riskMeta.label !== '—'
    })
    return filtered.slice(0, 8)
  }, [earningsData, earningsInsights, earningsRiskLabels])

  const sectorLeaders = useMemo(() => {
    if (!sectorWheel.length) return 'Mixed'
    const leaders = [...sectorWheel]
      .filter((s: any) => (s.changePercent ?? s.strength ?? 0) > 0)
      .sort((a: any, b: any) => (b.changePercent ?? b.strength ?? 0) - (a.changePercent ?? a.strength ?? 0))
      .slice(0, 2)
      .map((s: any) => s.name)
    return leaders.length ? leaders.join(', ') : 'Mixed'
  }, [sectorWheel])

  const marketMeaning = useMemo(() => {
    const volatility = Number(marketPulse.components.volatilityProxy || 0)
    if (marketPulse.label === 'Bullish' && volatility < 1.5) {
      return 'Momentum favors selective risk-taking in leading sectors.'
    }
    if (marketPulse.label === 'Risk-Off' || volatility >= 2.5) {
      return 'Caution bias: volatility argues for tighter risk and shorter horizons.'
    }
    return 'Balanced conditions favor selective positioning over broad risk-taking.'
  }, [marketPulse.label, marketPulse.components.volatilityProxy])

  const viewedWidgetData = useMemo(() => {
    if (searchHistory.length === 0) return null
    const base = Array.from(new Set(searchHistory)).slice(0, 3)
    const groupList = groupRecommendations(recommendationPool)
    return { base, groups: groupList }
  }, [searchHistory, recommendationPool])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navbar removed here; GlobalNavbar renders via app/layout.tsx */}

      {/* Ticker Tape - Just under navbar */}
      <div className="w-full bg-slate-900 border-b border-slate-800">
        <TradingViewTickerTape />
      </div>

      {/* Hero Section */}
      <section className="relative max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Static gradient background replacing LiquidEther */}
        <div className="absolute inset-0 -z-10 pointer-events-none bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="text-center">
          <Reveal variant="rise" delay={0}>
            <HeadlineRotator className="mb-6" />
          </Reveal>
          <Reveal variant="fade" delay={0.1}>
            <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto">
              Track your portfolio in real-time with AI-driven analysis, automated alerts, 
              and intelligent market insights powered by Groq's Llama-3.
            </p>
          </Reveal>
          <Reveal variant="scale" delay={0.2}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/dashboard"
                className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition shadow-lg hover:shadow-xl hover-card"
              >
                Launch Dashboard →
              </Link>
              <Link
                href="/ai"
                className="inline-block bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-4 rounded-lg text-base font-semibold hover:from-purple-700 hover:to-purple-800 transition shadow-lg hover:shadow-xl hover-card"
              >
                <Brain className="inline-block w-5 h-5 mr-2" />
                AI
              </Link>
              {!isLoggedIn && (
                <Link
                  href="/auth/signup"
                  className="inline-block bg-slate-800 border border-slate-700 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-slate-700 transition hover-card"
                >
                  Get Started Free
                </Link>
              )}
            </div>
          </Reveal>
          
          {/* Trust Indicators */}
          <StaggerGrid staggerDelay={0.05} variant="rise" className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">100%</div>
              <div className="text-sm text-slate-400">Free Forever</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">Real-time</div>
              <div className="text-sm text-slate-400">Data Updates</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">AI</div>
              <div className="text-sm text-slate-400">Powered Insights</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">Secure</div>
              <div className="text-sm text-slate-400">& Private</div>
            </div>
          </StaggerGrid>
        </div>
      </section>

      {/* AI Chat Section */}
      <section className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Reveal variant="fade">
          <InlineAIChat isLoggedIn={isLoggedIn} focusSymbol={focusSymbol} />
        </Reveal>
      </section>

      {/* Stock Heatmap */}
      <section className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Reveal variant="slide-left">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">Market Heatmap</h2>
        </Reveal>
        <Reveal variant="fade" delay={0.1}>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <TradingViewHeatmap />
          </div>
        </Reveal>
      </section>

      {/* Popular Today Stocks */}
      <Reveal variant="fade">
        <PopularToday />
      </Reveal>

      {/* Live Market Preview */}
      <section className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Reveal variant="slide-left">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">Live Market Preview</h2>
        </Reveal>
        
        {/* Exchange Selector Buttons */}
        <Reveal variant="fade" delay={0.02}>
          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={() => setSelectedExchange('USA')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg border transition hover-card ${
                selectedExchange === 'USA'
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/50'
              }`}
            >
              <span className="text-2xl">🇺🇸</span>
              <span className="font-semibold">USA / NYSE</span>
            </button>
            <button
              onClick={() => setSelectedExchange('CAN')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg border transition hover-card ${
                selectedExchange === 'CAN'
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-red-500/50'
              }`}
            >
              <span className="text-2xl">🇨🇦</span>
              <span className="font-semibold">CAN / TSX</span>
            </button>
          </div>
        </Reveal>
        
        {/* Top Stocks */}
        <StaggerGrid staggerDelay={0.04} variant="scale" className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {currentStocks.map((symbol) => (
            <button
              key={symbol}
              onClick={() => {
                setSelectedSymbol(symbol)
                recordViewedTicker(symbol)
              }}
              className={`p-4 rounded-lg border transition hover-card ${
                selectedSymbol === symbol
                  ? selectedExchange === 'USA'
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-red-600 border-red-500'
                  : 'bg-slate-800 border-slate-700 hover:border-blue-500/50'
              }`}
            >
              <div className="text-white font-bold">{symbol}</div>
            </button>
          ))}
        </StaggerGrid>

          {/* Chart and Top Stories Side by Side */}
          <StaggerGrid staggerDelay={0.06} variant="fade" className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            {/* Advanced Chart */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden h-[700px] hover-card">
              {topQuotes && (
                <div className="p-4 pb-2">
                  <h3 className="text-2xl font-bold text-white mb-2">{selectedSymbol}</h3>
                  <div className="flex items-center gap-4">
                    <span className="text-4xl font-bold text-white">
                      ${topQuotes.price?.toFixed(2) || 'Loading...'}
                    </span>
                    <span className={`text-xl font-semibold ${
                      topQuotes.changePercent >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {topQuotes.changePercent >= 0 ? '+' : ''}{topQuotes.changePercent?.toFixed(2) || 0}%
                    </span>
                  </div>
                </div>
              )}
              <div className="h-[calc(700px-160px)] pb-4">
                <TradingViewAdvancedChart symbol={selectedSymbol} />
              </div>
            </div>

            {/* Top Stories Widget */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden h-[700px] flex flex-col hover-card">
              <div className="p-4 border-b border-slate-700 flex-shrink-0">
                <h3 className="text-2xl font-bold text-white">Top Stories</h3>
              </div>
              <div className="flex-1 overflow-hidden">
                <div style={{ width: '100%', height: '650px' }}>
                  <TradingViewTopStories 
                    displayMode="regular" 
                    width="100%" 
                    height="650"
                  />
                </div>
              </div>
            </div>
          </StaggerGrid>

          {/* Market Signals */}
          <div className="mt-10">
            <Reveal variant="fade">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">Market Signals</h3>
                  <p className="text-sm text-slate-400">Live pulse checks and AI-guided market context</p>
                </div>
                <div className="text-xs text-slate-500">Updates every few seconds</div>
              </div>
            </Reveal>

            {/* Row 1: 3 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Market Pulse Ring */}
              <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-6 hover-card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Market Pulse Ring</h4>
                    <p className="text-xs text-slate-400">Overall market health score</p>
                  </div>
                  <span
                    className="text-slate-500 text-sm"
                    title={`Components: breadth ${marketPulse.components.breadthPct?.toFixed?.(1) ?? marketPulse.components.breadthPct}%, adv/dec ${Number(marketPulse.components.advDecRatio || 0).toFixed(2)}, volatility ${Number(marketPulse.components.volatilityProxy || 0).toFixed(2)}%, momentum ${Number(marketPulse.components.momentumAvg || 0).toFixed(2)}%`}
                  >
                    ⓘ
                  </span>
                </div>
                {!signalsData ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-32 w-32 rounded-full bg-slate-700 mx-auto" />
                    <div className="h-4 bg-slate-700 rounded w-2/3 mx-auto" />
                    <div className="h-3 bg-slate-700 rounded w-1/2 mx-auto" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="relative h-32 w-32 rounded-full flex items-center justify-center motion-safe:animate-[pulse_4s_ease-in-out_infinite]"
                      style={{
                        background: `conic-gradient(${marketPulse.label === 'Bullish' ? '#34d399' : marketPulse.label === 'Risk-Off' ? '#f87171' : '#fbbf24'} ${marketPulse.score}%, rgba(30,41,59,0.8) ${marketPulse.score}% 100%)`
                      }}
                    >
                      <div className="h-24 w-24 rounded-full bg-slate-900 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-white">{marketPulse.score}</span>
                        <span className="text-xs text-slate-400">Pulse</span>
                      </div>
                    </div>
                    <div className={`text-sm font-semibold ${marketPulse.label === 'Bullish' ? 'text-emerald-400' : marketPulse.label === 'Risk-Off' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {marketPulse.label}
                    </div>
                    <div className="text-xs text-slate-500">Updated {new Date(marketPulse.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                )}
              </div>

              {/* AI Confidence Meter */}
              <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-6 hover-card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">AI Confidence Meter</h4>
                    <p className="text-xs text-slate-400">Next 24–48h directional bias</p>
                  </div>
                  <span className="text-slate-500 text-sm" title="AI-generated estimate, not financial advice.">ⓘ</span>
                </div>
                {!signalsData ? (
                  <div className="animate-pulse space-y-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-4 bg-slate-700 rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {confidenceBars.map((bar) => (
                      <div key={bar.symbol || bar.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{bar.label}</span>
                          <span className={`${bar.state === 'Bullish' ? 'text-emerald-400' : bar.state === 'Risk-Off' ? 'text-red-400' : 'text-yellow-400'}`}>
                            BullishAI Confidence: {bar.score}% {bar.state}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              bar.state === 'Bullish' ? 'bg-emerald-500' : bar.state === 'Risk-Off' ? 'bg-red-500' : 'bg-yellow-400'
                            }`}
                            style={{ width: `${bar.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Trade Radar */}
              <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-6 hover-card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Live Trade Radar</h4>
                    <p className="text-xs text-slate-400">BullishAI activity signals</p>
                  </div>
                  <span className="text-slate-500 text-sm" title="Aggregated demo trades and watchlist interest.">ⓘ</span>
                </div>
                {!radarData ? (
                  <div className="animate-pulse space-y-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-4 bg-slate-700 rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {radarItems.map((item) => (
                      <div key={`${item.type}-${item.symbol}`} className="flex items-center justify-between text-sm text-slate-300">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{item.emoji ? `${item.emoji} ${item.type}` : item.type}</span>
                          <span className="text-white font-semibold">{item.symbol}</span>
                        </div>
                        <span className="text-slate-400">{item.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: 2 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Market Weather */}
              <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-6 hover-card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Market Weather Forecast</h4>
                    <p className="text-xs text-slate-400">Short, AI-style market read</p>
                  </div>
                  <span className="text-slate-500 text-sm" title="Derived from pulse, breadth, and sector momentum.">ⓘ</span>
                </div>
                {!weatherData ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-6 bg-slate-700 rounded w-2/3" />
                    <div className="h-4 bg-slate-700 rounded w-full" />
                    <div className="h-4 bg-slate-700 rounded w-5/6" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl motion-safe:animate-[pulse_6s_ease-in-out_infinite]">{marketWeather.icon}</div>
                      <div>
                        <div className="text-lg font-semibold text-white">{marketWeather.headline}</div>
                        <p className="text-sm text-slate-400">{marketWeather.detail}</p>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Today’s Key Signals</div>
                      <div className="space-y-1 text-sm text-slate-400">
                        <div>📊 Market Breadth: {marketPulse.components.breadthPct.toFixed(1)}% stocks advancing</div>
                        <div>🌡️ Volatility Level: {marketPulse.components.volatilityProxy >= 2.5 ? 'High' : marketPulse.components.volatilityProxy >= 1.2 ? 'Moderate' : 'Low'} ({marketPulse.components.volatilityProxy.toFixed(2)}%)</div>
                        <div>🔄 Sector Leadership: {sectorLeaders}</div>
                        <div>⚠️ Risk Mode: {marketPulse.label}</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">What this means: {marketMeaning}</div>
                  </div>
                )}
              </div>

              {/* Sector Rotation Wheel */}
              <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-6 hover-card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Sector Rotation Wheel</h4>
                    <p className="text-xs text-slate-400">{signalsData?.market === 'CA' ? 'TSX sector flows' : 'US sector flows'}</p>
                  </div>
                  <span className="text-slate-500 text-sm" title="Approximation using sector ETF momentum.">ⓘ</span>
                </div>
                {moneyFlowSummary && (
                  <div className="text-xs text-slate-400 mb-4">
                    Money Flow Today:{' '}
                    <span className="text-emerald-400">🟢 {moneyFlowSummary.gainText}</span>{' '}
                    <span className="text-slate-500">/</span>{' '}
                    <span className="text-red-400">🔴 {moneyFlowSummary.lossText}</span>
                  </div>
                )}
                {!signalsData || sectorWheel.length === 0 ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-28 w-28 rounded-full bg-slate-700" />
                    <div className="h-4 bg-slate-700 rounded w-2/3" />
                    <div className="h-4 bg-slate-700 rounded w-1/2" />
                  </div>
                ) : (
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <svg
                        viewBox="0 0 120 120"
                        className="h-28 w-28 motion-safe:animate-[spin_18s_linear_infinite]"
                        onMouseLeave={() => setHoveredSector(null)}
                      >
                        {sectorSegments.map((seg) => {
                          const startRad = (Math.PI / 180) * (seg.startAngle - 90)
                          const endRad = (Math.PI / 180) * (seg.endAngle - 90)
                          const radius = 50
                          const x1 = 60 + radius * Math.cos(startRad)
                          const y1 = 60 + radius * Math.sin(startRad)
                          const x2 = 60 + radius * Math.cos(endRad)
                          const y2 = 60 + radius * Math.sin(endRad)
                          const largeArc = seg.endAngle - seg.startAngle > 180 ? 1 : 0
                          const d = `M60,60 L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} Z`
                          const isHovered = hoveredSector === seg.name
                          const rotation = rotationLabelForChange(seg.changePercent)
                          return (
                            <path
                              key={seg.name}
                              d={d}
                              fill={seg.color}
                              opacity={hoveredSector && !isHovered ? 0.35 : 1}
                              stroke="rgba(15,23,42,0.9)"
                              strokeWidth={1}
                              onMouseEnter={() => setHoveredSector(seg.name)}
                              title={`${seg.name}: ${seg.changePercent >= 0 ? '+' : ''}${seg.changePercent.toFixed(2)}% • ${rotation.label}`}
                            />
                          )
                        })}
                        <circle cx="60" cy="60" r="30" fill="#0f172a" />
                      </svg>
                      {hoveredSector && (
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-300 bg-slate-900/90 border border-slate-700 px-2 py-1 rounded">
                          {hoveredSector}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 text-sm text-slate-300">
                      {sectorWheel.map((sector) => {
                        const info = sectorInfo[sector.name]
                        const includes = info?.includes?.join(', ')
                        const change = Number(sector.changePercent ?? sector.strength ?? 0)
                        const rotation = rotationLabelForChange(change)
                        const arrow = change >= 0 ? '↑' : '↓'
                        return (
                          <div
                            key={sector.name}
                            className={`flex items-center justify-between gap-4 rounded-md px-2 py-1 transition ${
                              hoveredSector === sector.name ? 'bg-slate-700/60' : ''
                            }`}
                            onMouseEnter={() => setHoveredSector(sector.name)}
                            onMouseLeave={() => setHoveredSector(null)}
                            title={info ? `Includes: ${includes}. ${info.why}` : sector.name}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: sectorColorMap[sector.name] || '#64748b' }}
                              />
                              {sector.name}
                            </span>
                            <span className={`${change > 0.01 ? 'text-emerald-300' : change < -0.01 ? 'text-red-300' : 'text-slate-400'}`}>
                              {(() => {
                                if (change !== 0 && Math.abs(change) < 0.01) {
                                  return `${arrow} ${change < 0 ? '-' : '+'}0.01%`
                                }
                                return `${arrow} ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
                              })()}
                            </span>
                            <span className={`text-xs ${rotation.color}`}>
                              {rotation.icon} {rotation.label}
                            </span>
                          </div>
                        )
                      })}
                      {hoveredSectorDetails && (
                        <div className="mt-2 text-xs text-slate-400">
                          <div className="text-slate-200 font-semibold">{hoveredSector}</div>
                          {hoveredSectorData && (
                            <div>
                              Today:{' '}
                              <span className={Number(hoveredSectorData.changePercent ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                                {Number(hoveredSectorData.changePercent ?? 0) >= 0 ? '+' : ''}
                                {Number(hoveredSectorData.changePercent ?? 0).toFixed(2)}%
                              </span>{' '}
                              • {rotationLabelForChange(Number(hoveredSectorData.changePercent ?? 0)).label}
                            </div>
                          )}
                          <div>Includes: {hoveredSectorDetails.includes.join(', ')}</div>
                          <div>{hoveredSectorDetails.why}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Earnings Timeline */}
            {earningsItems.length > 0 && (
              <div className="mt-6 bg-slate-800/80 rounded-xl border border-slate-700 p-6 hover-card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Earnings Impact Timeline</h4>
                    <p className="text-xs text-slate-400">Next 7–14 days catalysts</p>
                  </div>
                  <span className="text-slate-500 text-sm" title="Expected volatility and historical reaction indicators.">ⓘ</span>
                </div>
                {!earningsData ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-slate-700 rounded w-full" />
                    <div className="h-4 bg-slate-700 rounded w-3/4" />
                  </div>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {earningsItems.map((item: any, index: number) => {
                      const volatilityProxy = Number(marketPulse.components.volatilityProxy || 0)
                      const volatilityLabel = volatilityProxy >= 2.5 ? 'High' : volatilityProxy >= 1.2 ? 'Med' : 'Low'
                      const symbol = String(item.symbol || '').toUpperCase()
                      const metrics = earningsInsights?.items?.[symbol] || {}
                      const lastMove = metrics.lastReaction !== undefined && metrics.lastReaction !== null ? Number(metrics.lastReaction) : null
                      const typicalMove = metrics.typicalMove !== undefined && metrics.typicalMove !== null ? Number(metrics.typicalMove) : null
                      const realizedVol = metrics.realizedVol !== undefined && metrics.realizedVol !== null ? Number(metrics.realizedVol) : null
                      const changePercent = metrics.changePercent !== undefined && metrics.changePercent !== null ? Number(metrics.changePercent) : null
                      const riskMeta = earningsRiskLabels.get(symbol) || { score: null, label: '—' }
                      const riskLabel = riskMeta.label
                      const riskColor = riskLabel === 'High Risk'
                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                        : riskLabel === 'Medium Risk'
                          ? 'bg-yellow-500/15 text-yellow-200 border-yellow-500/40'
                          : riskLabel === 'Low Risk'
                            ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
                            : 'bg-slate-700/40 text-slate-400 border-slate-600/40'
                      let bias = 'Mixed expectations'
                      if (riskLabel === 'High Risk') {
                        bias = changePercent && changePercent > 0.5 ? 'High volatility setup' : 'Caution: uncertainty elevated'
                      } else if (riskLabel === 'Low Risk') {
                        bias = changePercent && changePercent > 0 ? 'Stable setup' : 'Defensive posture'
                      } else if (riskLabel === 'Medium Risk') {
                        bias = changePercent && changePercent > 0.3 ? 'Mixed expectations' : 'Balanced expectations'
                      } else {
                        bias = 'Limited data'
                      }
                      const timeLabel = String(item.time || 'BMO')
                      const timeTag = timeLabel.toLowerCase().includes('after') || timeLabel.toLowerCase().includes('pm') || timeLabel.toLowerCase().includes('amc') ? 'AMC' : 'BMO'
                      const eventDate = item.date ? new Date(`${item.date}T${timeTag === 'AMC' ? '16:00:00' : '09:00:00'}`) : null
                      const now = new Date()
                      let countdownLabel = '—'
                      if (eventDate && !Number.isNaN(eventDate.getTime())) {
                        const diffMs = eventDate.getTime() - now.getTime()
                        if (diffMs < -3600000) {
                          countdownLabel = '—'
                        } else {
                        const diffHours = Math.max(0, Math.round(diffMs / 36e5))
                        const diffDays = Math.floor(diffHours / 24)
                        if (diffHours <= 24 && diffHours >= 0) {
                          countdownLabel = diffHours <= 1 ? `Today (${timeTag})` : `Tomorrow (${timeTag})`
                        } else {
                          const hoursRemainder = diffHours - diffDays * 24
                          countdownLabel = `In ${diffDays}d ${hoursRemainder}h`
                        }
                        }
                      }
                      const highlightToday = countdownLabel.startsWith('Today')
                      return (
                        <button
                          key={`${item.symbol}-${item.date}-${item.time || 'time'}-${index}`}
                          onClick={() => window.location.assign(`/stocks/${item.symbol}`)}
                          className={`min-w-[220px] bg-slate-900 border rounded-lg p-4 text-left hover:border-blue-500/60 transition ${highlightToday ? 'border-amber-400/60 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]' : 'border-slate-700'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-semibold">{symbol}</span>
                            <span className="text-xs text-slate-400">{countdownLabel}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                            <span>{item.date}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full border text-[11px] ${riskColor}`}
                              title={riskLabel === '—' ? 'Limited data' : `Risk score: ${riskMeta.score?.toFixed(0) ?? '—'}`}
                            >
                              {riskLabel === '—' ? 'Risk: —' : riskLabel}
                            </span>
                          </div>
                          <div className="text-sm text-slate-300">
                            Volatility: <span className="text-white">{volatilityLabel}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Typical move: {typicalMove !== null && Number.isFinite(typicalMove) && Math.abs(typicalMove) >= 0.05 ? `±${typicalMove.toFixed(1)}%` : '—'}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Last reaction: {lastMove !== null && Number.isFinite(lastMove) && Math.abs(lastMove) >= 0.05 ? `${lastMove > 0 ? '+' : ''}${lastMove.toFixed(1)}%` : '—'}
                          </div>
                          <div className="text-xs text-slate-500 mt-2">
                            AI bias: <span className="text-slate-300">{bias}</span>
                          </div>
                          {metrics?.eligible && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                              {metrics.dividend?.status === 'Pays' && (
                                <>
                                  <span
                                    className="px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-200"
                                    title="Dividend status for this ticker."
                                  >
                                    Dividend
                                  </span>
                                  <span title="Next pay date (if available).">Pay: {metrics.dividend?.payDate || '—'}</span>
                                  <span title="Ex-dividend date (if available).">Ex: {metrics.dividend?.exDate || '—'}</span>
                                  <span title="Annualized yield estimate (if available).">
                                    Yield: {metrics.dividend?.yield && metrics.dividend?.yield > 0 ? `${metrics.dividend.yield.toFixed(2)}%${metrics.dividend.yieldEstimated ? ' est.' : ''}` : '—'}
                                  </span>
                                </>
                              )}
                              {metrics.dividend?.status !== 'Pays' && (
                                <span className="px-2 py-0.5 rounded-full border border-slate-600/40 text-slate-400">
                                  Dividends: Not supported
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Row 4: Because You Viewed (conditional) */}
            {viewedWidgetData && (
              <div className="mt-6 bg-slate-800/80 rounded-xl border border-slate-700 p-6 hover-card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Because You Viewed…</h4>
                    <p className="text-xs text-slate-400">Personalized watchlist ideas</p>
                  </div>
                  <span className="text-slate-500 text-sm" title="Based on your recent searches and views.">ⓘ</span>
                </div>
                <div className="text-sm text-slate-300 mb-3">
                  Because you viewed <span className="text-white font-semibold">{viewedWidgetData.base.join(' & ')}</span>:
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  {viewedWidgetData.groups.map((group) => (
                    <div key={group.title} className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-slate-300">
                      <div className="text-slate-200 font-semibold mb-2">{group.title}</div>
                      <div className="grid gap-3">
                        {group.tickers.map((ticker) => (
                          <button
                            key={ticker}
                            onClick={() => window.location.assign(`/stocks/${ticker}`)}
                            className="text-left rounded-xl border border-slate-700 bg-slate-950/60 p-3 hover:border-blue-500/60 transition"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-semibold text-white">{ticker}</div>
                              {pricesByTicker[ticker] !== undefined && (
                                <div className="text-xs text-slate-400">${pricesByTicker[ticker].toFixed(2)}</div>
                              )}
                            </div>
                            <div className="h-[160px] w-full overflow-hidden rounded-lg border border-slate-800">
                              <TradingViewMiniChart symbol={ticker} />
                            </div>
                          </button>
                        ))}
                        {group.tickers.length === 0 && (
                          <span className="text-xs text-slate-500">No more related tickers available.</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Row 5: Upcoming Earnings & Dividends (logged-out only) */}
            {!isLoggedIn && (
              <div className="mt-6 grid lg:grid-cols-2 gap-4">
                <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5 hover-card">
                  <div className="flex items-center justify-between mb-3">
                    <Link href="/calendar?tab=earnings" className="text-lg font-semibold text-white hover:underline">
                      Earnings
                    </Link>
                    <Link href="/calendar?tab=earnings" className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
                      View calendar <span>›</span>
                    </Link>
                  </div>
                  {!earningsData ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-slate-700 rounded w-3/4" />
                      <div className="h-4 bg-slate-700 rounded w-2/3" />
                      <div className="h-4 bg-slate-700 rounded w-1/2" />
                    </div>
                  ) : upcomingEarnings.length === 0 ? (
                    <div className="text-sm text-slate-400">No major earnings in the next 7 days.</div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingEarnings.slice(0, 8).map((item: any) => {
                        const symbol = String(item.symbol || '').toUpperCase()
                        const timeTag = String(item.time || 'BMO').toLowerCase().includes('after') || String(item.time || '').toLowerCase().includes('pm') || String(item.time || '').toLowerCase().includes('amc')
                          ? 'AMC'
                          : 'BMO'
                        const countdown = formatCountdown(item.date, timeTag)
                        const riskMeta = earningsRiskLabels.get(symbol) || { label: '—' }
                        const riskLabel = riskMeta.label
                        const riskColor = riskLabel === 'High Risk'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : riskLabel === 'Medium Risk'
                            ? 'bg-yellow-500/15 text-yellow-200 border-yellow-500/40'
                            : riskLabel === 'Low Risk'
                              ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
                              : 'bg-slate-700/40 text-slate-400 border-slate-600/40'
                        const bias = earningsBiasLabel(symbol)
                        return (
                          <button
                            key={`${symbol}-${item.date}`}
                            onClick={() => window.location.assign(`/stocks/${symbol}`)}
                            className="w-full text-left flex items-center justify-between text-sm text-slate-300 border-b border-slate-700/40 pb-2 hover:text-white transition"
                          >
                            <div>
                              <div className="text-white font-semibold">{symbol}</div>
                              <div className="text-xs text-slate-400">{item.date} • {timeTag}</div>
                              <div className="text-[11px] text-slate-500 mt-1">{bias}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">{countdown}</span>
                              <span className={`px-2 py-0.5 rounded-full border text-[11px] ${riskColor}`}>
                                {riskLabel.replace(' Risk', '')}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5 hover-card">
                  <div className="flex items-center justify-between mb-3">
                    <Link href="/calendar?tab=dividends" className="text-lg font-semibold text-white hover:underline">
                      Dividends
                    </Link>
                    <Link href="/calendar?tab=dividends" className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
                      View calendar <span>›</span>
                    </Link>
                  </div>
                  {!dividendsData ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-slate-700 rounded w-3/4" />
                      <div className="h-4 bg-slate-700 rounded w-2/3" />
                      <div className="h-4 bg-slate-700 rounded w-1/2" />
                    </div>
                  ) : upcomingDividends.length === 0 ? (
                    <div className="text-sm text-slate-400">Data unavailable.</div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingDividends.slice(0, 8).map((item: any) => {
                        const symbol = String(item.symbol || '').toUpperCase()
                        const yieldPct = Number(item.yield || 0)
                        const exDate = item.exDate || item.date || null
                        const payDate = item.payDate || null
                        const amount = item.amount ? Number(item.amount) : null
                        const label = exDate ? `Ex-div ${formatCountdown(exDate, 'BMO')}` : payDate ? `Pays ${formatCountdown(payDate, 'BMO')}` : '—'
                        return (
                          <button
                            key={`${symbol}-${exDate || payDate}`}
                            onClick={() => window.location.assign(`/stocks/${symbol}`)}
                            className="w-full text-left flex items-center justify-between text-sm text-slate-300 border-b border-slate-700/40 pb-2 hover:text-white transition"
                          >
                            <div>
                              <div className="text-white font-semibold">{symbol}</div>
                              <div className="text-xs text-slate-400">
                                Yield: {yieldPct > 0 ? `${yieldPct.toFixed(2)}%` : '—'} • Ex: {exDate || '—'} • Pay: {payDate || '—'}
                              </div>
                            </div>
                            <div className="text-xs text-slate-400">
                              {amount ? `$${amount.toFixed(2)}` : '—'}
                              <div className="text-[10px] text-slate-500">{label}</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Row 6: Portfolio Simulation Preview (logged-out only) */}
            {!isLoggedIn && (
              <div className="mt-6 bg-slate-800/80 rounded-xl border border-slate-700 p-6 hover-card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Portfolio Simulation Preview</h4>
                    <p className="text-xs text-slate-400">Demo-only, not a guarantee</p>
                  </div>
                  <span className="text-slate-500 text-sm" title="Simulation based on historical demo data. Not financial advice.">ⓘ</span>
                </div>
                <div className="grid md:grid-cols-[2fr_1fr] gap-6 items-center">
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                    <div className="text-xs text-slate-400 mb-2">If you told BullishAI to start with $1,000 last month…</div>
                    <div className="text-2xl font-bold text-white mb-2">$1,146.80</div>
                    <div className="text-sm text-emerald-400">+14.6% simulated return</div>
                    <svg viewBox="0 0 200 80" className="mt-4 w-full h-20">
                      <defs>
                        <linearGradient id="simGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,60 C20,50 40,55 60,45 C80,35 100,38 120,30 C140,22 160,26 180,18 L200,15"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3"
                      />
                      <path
                        d="M0,60 C20,50 40,55 60,45 C80,35 100,38 120,30 C140,22 160,26 180,18 L200,15 L200,80 L0,80 Z"
                        fill="url(#simGradient)"
                      />
                    </svg>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-slate-300">
                      Demo performance preview based on historical patterns. Results are illustrative only.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Link
                        href="/auth/signup"
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition"
                      >
                        Create Free Account
                      </Link>
                      <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:border-slate-400 transition"
                      >
                        Launch Demo
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

      {/* Features */}
      <section className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Reveal variant="fade">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Everything You Need</h2>
            <p className="text-xl text-slate-400">Powerful tools for informed trading decisions</p>
          </div>
        </Reveal>
        
          <StaggerGrid staggerDelay={0.04} variant="rise" className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <TiltCard className="rounded-xl" hoverScale={1.04} rotateAmplitude={6}>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 p-8 rounded-xl border border-slate-700 hover:border-blue-500/50 transition group">
            <div className="h-16 w-16 bg-blue-500/10 rounded-lg flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition">
              <Search className="h-8 w-8 text-blue-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Real-Time Quotes</h3>
            <p className="text-slate-400 leading-relaxed">
              Get live stock prices updated every 15 seconds with reliable data from Finnhub and Twelve Data.
              Never miss a price movement.
            </p>
          </div>
          </TiltCard>
          
          <TiltCard className="rounded-xl" hoverScale={1.04} rotateAmplitude={6}>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 p-8 rounded-xl border border-slate-700 hover:border-purple-500/50 transition group">
            <div className="h-16 w-16 bg-purple-500/10 rounded-lg flex items-center justify-center mb-6 group-hover:bg-purple-500/20 transition">
              <Brain className="h-8 w-8 text-purple-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">AI Insights</h3>
            <p className="text-slate-400 leading-relaxed">
              Understand market movements with AI explanations, risk analysis, and portfolio summaries 
              powered by Groq's Llama-3.
            </p>
          </div>
          </TiltCard>

          <TiltCard className="rounded-xl" hoverScale={1.04} rotateAmplitude={6}>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 p-8 rounded-xl border border-slate-700 hover:border-green-500/50 transition group">
            <div className="h-16 w-16 bg-green-500/10 rounded-lg flex items-center justify-center mb-6 group-hover:bg-green-500/20 transition">
              <Bell className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Smart Alerts</h3>
            <p className="text-slate-400 leading-relaxed">
              Set price alerts and receive instant email notifications when your stocks cross thresholds. 
              Stay on top of your portfolio 24/7.
            </p>
          </div>
          </TiltCard>

          <TiltCard className="rounded-xl" hoverScale={1.04} rotateAmplitude={6}>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 p-8 rounded-xl border border-slate-700 hover:border-blue-500/50 transition group">
            <div className="h-16 w-16 bg-blue-500/10 rounded-lg flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition">
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Advanced Charts</h3>
            <p className="text-slate-400 leading-relaxed">
              Interactive charts for multiple timeframes (1D, 5D, 1M, 6M, 1Y) with detailed price analysis 
              and volume data.
            </p>
          </div>
          </TiltCard>

          <TiltCard className="rounded-xl" hoverScale={1.04} rotateAmplitude={6}>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 p-8 rounded-xl border border-slate-700 hover:border-yellow-500/50 transition group">
            <div className="h-16 w-16 bg-yellow-500/10 rounded-lg flex items-center justify-center mb-6 group-hover:bg-yellow-500/20 transition">
              <Shield className="h-8 w-8 text-yellow-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Secure & Private</h3>
            <p className="text-slate-400 leading-relaxed">
              Your data is encrypted and secure. We never share your information with third parties. 
              Bank-level security.
            </p>
          </div>
          </TiltCard>

          <TiltCard className="rounded-xl" hoverScale={1.04} rotateAmplitude={6}>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/30 p-8 rounded-xl border border-slate-700 hover:border-pink-500/50 transition group">
            <div className="h-16 w-16 bg-pink-500/10 rounded-lg flex items-center justify-center mb-6 group-hover:bg-pink-500/20 transition">
              <Zap className="h-8 w-8 text-pink-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Lightning Fast</h3>
            <p className="text-slate-400 leading-relaxed">
              Built with Next.js 15 for blazing-fast performance. Optimized for speed with automatic 
              caching and background updates.
            </p>
          </div>
          </TiltCard>
        </StaggerGrid>
      </section>

      {/* CTA Section */}
      <section className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-center border border-blue-500/50">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Start Tracking Your Portfolio Today
          </h2>
          <p className="text-xl text-slate-200 mb-8 max-w-2xl mx-auto">
            Join thousands of investors making smarter decisions with AI-powered insights.
            No credit card required. Free forever.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="inline-block bg-white text-blue-600 px-10 py-4 rounded-lg text-lg font-semibold hover:bg-slate-100 transition shadow-xl"
            >
              Launch Dashboard →
            </Link>
            <Link
              href="/auth/signup"
              className="inline-block bg-slate-800/50 border-2 border-white text-white px-10 py-4 rounded-lg text-lg font-semibold hover:bg-slate-800/70 transition"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
