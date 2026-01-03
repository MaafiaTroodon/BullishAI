'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery && searchQuery.length <= 5) {
      setSelectedSymbol(searchQuery.toUpperCase())
    }
  }

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
              onClick={() => setSelectedSymbol(symbol)}
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
