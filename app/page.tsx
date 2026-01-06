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
import useSWR from 'swr'
import { Reveal } from '@/components/anim/Reveal'
import { StaggerGrid } from '@/components/anim/StaggerGrid'
import { ParallaxImage } from '@/components/anim/ParallaxImage'
import { Footer } from '@/components/Footer'
import { authClient } from '@/lib/auth-client'

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

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExchange, setSelectedExchange] = useState<'USA' | 'CAN'>('USA')
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [focusSymbol, setFocusSymbol] = useState<string | undefined>(undefined)
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([])
  
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
          setRecentlyViewed(parsed.map((t) => String(t).toUpperCase()))
        }
      }
    } catch {}
  }, [])

  const recordViewedTicker = (symbol: string) => {
    if (typeof window === 'undefined') return
    try {
      const normalized = symbol.toUpperCase()
      const raw = localStorage.getItem('recentlyViewedTickers')
      const existing = raw ? JSON.parse(raw) : []
      const list = Array.isArray(existing) ? existing.map((t: string) => String(t).toUpperCase()) : []
      const next = [normalized, ...list.filter((t: string) => t !== normalized)].slice(0, 5)
      localStorage.setItem('recentlyViewedTickers', JSON.stringify(next))
      setRecentlyViewed(next)
    } catch {}
  }


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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery && searchQuery.length <= 5) {
      const symbol = searchQuery.toUpperCase()
      setSelectedSymbol(symbol)
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

  const earningsItems = useMemo(() => {
    const items = earningsData?.items || []
    if (items.length === 0) return []
    if (selectedExchange === 'CAN') {
      return items.filter((item: any) => String(item.symbol || '').toUpperCase().includes('.TO')).slice(0, 10)
    }
    return items.filter((item: any) => !String(item.symbol || '').toUpperCase().includes('.TO')).slice(0, 10)
  }, [earningsData, selectedExchange])

  const viewedWidgetData = useMemo(() => {
    if (recentlyViewed.length === 0) return null
    const base = recentlyViewed.slice(0, 2)
    const suggestions = [
      'Similar momentum stocks',
      'Better valuation alternatives',
      'Risk-reduced options',
    ]
    return { base, suggestions }
  }, [recentlyViewed])

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
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="text-4xl motion-safe:animate-[pulse_6s_ease-in-out_infinite]">{marketWeather.icon}</div>
                    <div>
                      <div className="text-lg font-semibold text-white">{marketWeather.headline}</div>
                      <p className="text-sm text-slate-400">{marketWeather.detail}</p>
                    </div>
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
                <div className="flex items-center gap-5">
                  <div
                    className="h-28 w-28 rounded-full motion-safe:animate-[spin_18s_linear_infinite]"
                    style={{
                      background: `conic-gradient(${sectorWheel.map((s, idx) => {
                        const base = idx * (360 / sectorWheel.length)
                        const hue = 200 + idx * 25
                        return `hsl(${hue}, 70%, 55%) ${base}deg ${base + 360 / sectorWheel.length}deg`
                      }).join(',')})`
                    }}
                  />
                  <div className="space-y-2 text-sm text-slate-300">
                  {sectorWheel.slice(0, 4).map((sector) => (
                    <div key={sector.name} className="flex items-center justify-between gap-4">
                      <span>{sector.name}</span>
                      <span className="text-slate-400">{Number(sector.changePercent ?? sector.strength ?? 0).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
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
                    {earningsItems.map((item: any) => {
                      const volatilityProxy = Number(marketPulse.components.volatilityProxy || 0)
                      const volatilityLabel = volatilityProxy >= 2.5 ? 'High' : volatilityProxy >= 1.2 ? 'Med' : 'Low'
                      return (
                        <button
                          key={`${item.symbol}-${item.date}`}
                          onClick={() => window.location.assign(`/stocks/${item.symbol}`)}
                          className="min-w-[220px] bg-slate-900 border border-slate-700 rounded-lg p-4 text-left hover:border-blue-500/60 transition"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-semibold">{item.symbol}</span>
                            <span className="text-xs text-slate-400">{item.time || 'BMO'}</span>
                          </div>
                          <div className="text-xs text-slate-400 mb-2">{item.date}</div>
                          <div className="text-sm text-slate-300">
                            Volatility: <span className="text-white">{volatilityLabel}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Past reaction: {item.pastReactionPct !== undefined ? `${item.pastReactionPct > 0 ? '↑' : '↓'} ${Math.abs(item.pastReactionPct).toFixed(1)}%` : '—'}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            AI confidence: {item.aiConfidence || '—'}
                          </div>
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
                  {viewedWidgetData.suggestions.map((item) => (
                    <div key={item} className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Row 5: Portfolio Simulation Preview (logged-out only) */}
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
