'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, TrendingUp, TrendingDown, Settings, LogOut, User as UserIcon, Bell, ChevronDown } from 'lucide-react'
import useSWR from 'swr'
import { StockChart } from '@/components/charts/StockChart'
import { NewsFeed } from '@/components/NewsFeed'
import { DevStatus } from '@/components/DevStatus'
import { AIInsights } from '@/components/AIInsights'
import dynamic from 'next/dynamic'
const PortfolioChartComp = dynamic(() => import('@/components/PortfolioChart').then(m => m.PortfolioChart), { ssr: false })
const PortfolioHoldingsComp = dynamic(() => import('@/components/PortfolioHoldings').then(m => m.PortfolioHoldings), { ssr: false })
const PortfolioSummaryComp = dynamic(() => import('@/components/PortfolioSummary').then(m => m.PortfolioSummary), { ssr: false })

const fetcher = (url: string) => fetch(url).then(r => r.json())
const DEFAULT_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX']

export default function Dashboard() {
  const router = useRouter()
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
  const [searchQuery, setSearchQuery] = useState('')
  const [chartRange, setChartRange] = useState('1d')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [watchlistItems, setWatchlistItems] = useState<string[]>([])
  const [isClient, setIsClient] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Load watchlist from localStorage
  useEffect(() => {
    setIsClient(true)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('watchlistItems')
      if (saved) {
        const items = JSON.parse(saved)
        setWatchlistItems(items)
      } else {
        setWatchlistItems(DEFAULT_STOCKS)
      }
    }
  }, [])

  // Batch fetch quotes for watchlist
  const { data: batchQuotesData, isLoading: isLoadingBatchQuotes } = useSWR(
    watchlistItems.length > 0 ? `/api/quotes?symbols=${watchlistItems.join(',')}` : null,
    fetcher,
    { refreshInterval: 30000 }
  )

  const batchQuotes = batchQuotesData?.quotes || []

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

  const handleSelectSuggestion = (symbol: string, name: string) => {
    router.push(`/stocks/${symbol}`)
    setSearchQuery('')
    setShowSuggestions(false)
    setSearchSuggestions([])
  }

  const { data: quote, isLoading: isLoadingQuote } = useSWR(
    `/api/quote?symbol=${selectedSymbol}`,
    fetcher,
    { refreshInterval: 15000 }
  )

  const { data: chartApiData, isLoading: isLoadingChart } = useSWR(
    `/api/chart?symbol=${selectedSymbol}&range=${chartRange}`,
    fetcher
  )

  const { data: newsData, isLoading: isLoadingNews } = useSWR(
    `/api/news?symbol=${selectedSymbol}`,
    fetcher
  )

  return (
    <div className="min-h-screen bg-slate-900">
      <DevStatus />
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center">
                <TrendingUp className="h-6 w-6 text-blue-500" />
                <span className="ml-2 text-xl font-bold text-white">BullishAI</span>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/dashboard" className="text-white font-medium">Dashboard</Link>
                <Link href="/watchlist" className="text-slate-400 hover:text-white transition">Watchlist</Link>
                <Link href="/news" className="text-slate-400 hover:text-white transition">News</Link>
                <Link href="/alerts" className="text-slate-400 hover:text-white transition">Alerts</Link>
              </nav>
            </div>

            {/* Search Bar */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <form className="relative w-full" onSubmit={(e) => e.preventDefault()}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onBlur={() => {
                    // Delay hiding to allow click
                    setTimeout(() => setShowSuggestions(false), 200)
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && searchQuery) {
                      router.push(`/stocks/${searchQuery.toUpperCase()}`)
                      setShowSuggestions(false)
                      setSearchQuery('')
                    }
                  }}
                  placeholder="Search stocks..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                    {searchSuggestions.map((item, idx) => (
                      <button
                        key={`${item.symbol}-${idx}`}
                        type="button"
                        onClick={() => handleSelectSuggestion(item.symbol, item.name)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-700 transition text-white border-b border-slate-700 last:border-b-0"
                      >
                        <div className="font-semibold">{item.symbol}</div>
                        <div className="text-sm text-slate-400">{item.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </form>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative text-slate-400 hover:text-white transition"
                >
                  <Bell className="h-6 w-6" />
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
                    3
                  </span>
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-slate-700">
                      <h3 className="text-white font-semibold">Notifications</h3>
                    </div>
                    <div className="p-4 text-sm text-slate-400">
                      <p>AAPL crossed above $150.00</p>
                      <p className="text-xs text-slate-500 mt-1">2 hours ago</p>
                    </div>
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                    JD
                  </div>
                  <span className="hidden md:block">John Doe</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                    {userMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
                        <Link href="/settings" className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-t-lg">
                          <Settings className="h-4 w-4" />
                          Settings
                        </Link>
                        <button 
                          onClick={() => {
                            alert('Logged out successfully!')
                            router.push('/')
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-b-lg text-left"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      </div>
                    )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Portfolio Overview - Wealthsimple style */}
        <div className="space-y-6">
          {/* Summary Card at top - shows total balance and return */}
          <PortfolioSummaryComp />
          
          {/* Large prominent chart */}
          <PortfolioChartComp />
          
          {/* Holdings list below */}
          <PortfolioHoldingsComp />
        </div>
        
      </main>
    </div>
  )
}

