'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, TrendingUp, TrendingDown, Settings, LogOut, User as UserIcon, Bell, ChevronDown } from 'lucide-react'
import useSWR from 'swr'
import { StockChart } from '@/components/charts/StockChart'
import { NewsFeed } from '@/components/NewsFeed'
import { DevStatus } from '@/components/DevStatus'

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Price Card */}
        {isLoadingQuote ? (
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 animate-pulse">
            <div className="h-8 bg-slate-700 rounded w-24 mb-4"></div>
            <div className="h-12 bg-slate-700 rounded w-32"></div>
          </div>
        ) : quote && quote.price ? (
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">{quote.symbol}</h2>
              {quote.changePercent !== undefined && (
                quote.changePercent >= 0 ? (
                  <div className="flex items-center text-green-500">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    <span className="text-xl font-semibold">
                      {quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)} ({quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-500">
                    <TrendingDown className="h-5 w-5 mr-2" />
                    <span className="text-xl font-semibold">
                      {quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                )
              )}
            </div>
            <div className="text-4xl font-bold text-white mb-6">
              ${quote.price.toFixed(2)}
            </div>
            
            {/* Full Stock Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
              <div>
                <div className="text-slate-400 mb-1">Open</div>
                <div className="text-white font-semibold">${quote.open?.toFixed(2) || 'N/A'}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">High</div>
                <div className="text-white font-semibold">${quote.high?.toFixed(2) || 'N/A'}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Low</div>
                <div className="text-white font-semibold">${quote.low?.toFixed(2) || 'N/A'}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Prev Close</div>
                <div className="text-white font-semibold">${quote.previousClose?.toFixed(2) || 'N/A'}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Volume</div>
                <div className="text-white font-semibold">{quote.volume ? (quote.volume / 1000000).toFixed(1) + 'M' : 'N/A'}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Market Cap</div>
                <div className="text-white font-semibold">{quote.marketCap ? (quote.marketCap / 1000000000).toFixed(1) + 'B' : 'N/A'}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">P/E Ratio</div>
                <div className="text-white font-semibold">{quote.peRatio?.toFixed(2) || 'N/A'}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">52W High</div>
                <div className="text-white font-semibold">${quote.week52High?.toFixed(2) || 'N/A'}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">52W Low</div>
                <div className="text-white font-semibold">${quote.week52Low?.toFixed(2) || 'N/A'}</div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Chart Section */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            {['1d', '5d', '1m', '6m', '1y', '5y'].map((range) => (
              <button
                key={range}
                onClick={() => setChartRange(range)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  chartRange === range
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
          {isLoadingChart ? (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 h-[400px] flex items-center justify-center">
              <p className="text-slate-400">Loading chart...</p>
            </div>
          ) : chartApiData && chartApiData.data && Array.isArray(chartApiData.data) && chartApiData.data.length >= 2 ? (
            <StockChart data={chartApiData.data} symbol={selectedSymbol} range={chartRange} source={chartApiData.source} />
          ) : chartApiData && chartApiData.data && chartApiData.data.length < 2 ? (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 h-[400px] flex items-center justify-center">
              <p className="text-slate-400">No chart data available (free-tier limit)</p>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 h-[400px] flex items-center justify-center">
              <p className="text-slate-400">Chart data loading...</p>
            </div>
          )}
        </div>

        {/* News Section */}
        <div className="mb-8">
          {isLoadingNews ? (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <p className="text-slate-400">Loading news...</p>
            </div>
          ) : newsData && newsData.items && newsData.items.length > 0 ? (
            <NewsFeed news={newsData.items.map((item: any) => ({
              headline: item.headline,
              summary: item.summary,
              source: item.source,
              url: item.url,
              image: item.image,
              datetime: item.datetime,
            }))} symbol={selectedSymbol} />
          ) : (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <p className="text-slate-400">No recent news available</p>
            </div>
          )}
        </div>

        {/* Watchlist & AI Insights */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">My Watchlist</h3>
              <Link 
                href="/watchlist" 
                className="text-blue-500 hover:text-blue-400 text-sm font-medium"
              >
                View All →
              </Link>
            </div>
            {watchlistItems.length > 0 ? (
              <div className="space-y-3">
                {watchlistItems.slice(0, 5).map((symbol) => {
                  const quote = batchQuotes.find((q: any) => q.symbol === symbol)
                  return (
                    <div 
                      key={symbol}
                      className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 cursor-pointer transition"
                      onClick={() => setSelectedSymbol(symbol)}
                    >
                      <div>
                        <div className="font-semibold text-white">{symbol}</div>
                        {quote && quote.data && !isLoadingBatchQuotes ? (
                          <div className="text-sm text-slate-400">
                            ${quote.data.price?.toFixed(2) || 'N/A'}
                          </div>
                        ) : (
                          <div className="h-4 w-16 bg-slate-600 rounded animate-pulse"></div>
                        )}
                      </div>
                      {quote && quote.data && !isLoadingBatchQuotes && (
                        <div className={`flex items-center ${quote.data.dp >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {quote.data.dp >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span className="ml-1 text-sm font-medium">
                            {quote.data.dp >= 0 ? '+' : ''}{quote.data.dp?.toFixed(2) || '0.00'}%
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-400 mb-4">Your watchlist is empty</p>
                <Link 
                  href="/watchlist"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                >
                  Add Stocks
                </Link>
              </div>
            )}
          </div>
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">AI Insights</h3>
            <p className="text-slate-400">AI insights will appear here...</p>
          </div>
        </div>
      </main>
    </div>
  )
}

