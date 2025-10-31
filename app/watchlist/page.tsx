'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, TrendingUp, TrendingDown, Star } from 'lucide-react'
import useSWR from 'swr'
import { GlobalNavbar } from '@/components/GlobalNavbar'
import TradingViewMiniChart from '@/components/TradingViewMiniChart'

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

const DEFAULT_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX']

export default function WatchlistPage() {
  const [watchlistItems, setWatchlistItems] = useState(DEFAULT_STOCKS)
  const [starredItems, setStarredItems] = useState<string[]>([])
  const [isClient, setIsClient] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
  const [newSymbol, setNewSymbol] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])

  // Load from localStorage on client mount
  useEffect(() => {
    setIsClient(true)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('watchlistItems')
      if (saved) {
        setWatchlistItems(JSON.parse(saved))
      }
      const savedStars = localStorage.getItem('starredItems')
      if (savedStars) {
        setStarredItems(JSON.parse(savedStars))
      }
    }
  }, [])

  // Save to localStorage whenever items change
  useEffect(() => {
    if (isClient && typeof window !== 'undefined') {
      localStorage.setItem('watchlistItems', JSON.stringify(watchlistItems))
    }
  }, [watchlistItems, isClient])

  // Save starred items to localStorage
  useEffect(() => {
    if (isClient && typeof window !== 'undefined') {
      localStorage.setItem('starredItems', JSON.stringify(starredItems))
    }
  }, [starredItems, isClient])

  const { data: quotesData, isLoading: isLoadingQuotes } = useSWR(
    `/api/quotes?symbols=${watchlistItems.join(',')}`,
    fetcher,
    { refreshInterval: 30000 }
  )

  const handleAddSymbol = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newSymbol && !watchlistItems.includes(newSymbol.toUpperCase())) {
      const newSymbols = newSymbol.split(/[,\s\n]+/).filter(s => s.trim())
      const validSymbols = newSymbols.map(s => s.toUpperCase()).filter(s => s.length <= 5)
      
      if (validSymbols.length > 0) {
        setWatchlistItems([...watchlistItems, ...validSymbols])
      }
      setNewSymbol('')
      setShowSuggestions(false)
    }
  }

  const handleRemoveSymbol = (symbol: string) => {
    const newItems = watchlistItems.filter(s => s !== symbol)
    setWatchlistItems(newItems)
    if (selectedSymbol === symbol && newItems.length > 0) {
      setSelectedSymbol(newItems[0])
    }
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('watchlistItems', JSON.stringify(newItems))
    }
  }

  const handleSearchChange = async (value: string) => {
    setNewSymbol(value.toUpperCase())
    
    if (value.length >= 1) {
      try {
        const response = await fetch(`/api/search?query=${value}`)
        const data = await response.json()
        if (data.results) {
          setSuggestions(data.results.slice(0, 5))
          setShowSuggestions(true)
        }
      } catch (error) {
        console.error('Search error:', error)
      }
    } else {
      setShowSuggestions(false)
    }
  }

  const handleSelectSuggestion = (symbol: string) => {
    if (!watchlistItems.includes(symbol)) {
      setWatchlistItems([...watchlistItems, symbol])
    }
    setNewSymbol('')
    setShowSuggestions(false)
  }

  const handleStarToggle = (symbol: string) => {
    setStarredItems(prev => {
      if (prev.includes(symbol)) {
        return prev.filter(s => s !== symbol)
      } else {
        return [...prev, symbol]
      }
    })
  }

  // Sort watchlist: starred items first, then alphabetical
  const sortedWatchlistItems = [...watchlistItems].sort((a, b) => {
    const aStarred = starredItems.includes(a)
    const bStarred = starredItems.includes(b)
    
    if (aStarred && !bStarred) return -1
    if (!aStarred && bStarred) return 1
    return a.localeCompare(b)
  })

  const quotes = quotesData?.quotes || []

  return (
    <div className="min-h-screen bg-slate-900">
      <GlobalNavbar />
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">My Watchlist</h1>
            <p className="text-slate-400">Track your favorite stocks</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition">
              <Plus className="h-4 w-4" />
              New Watchlist
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Watchlist Table */}
          <div className="lg:col-span-6">
            {/* Add Symbol Input */}
            <form onSubmit={handleAddSymbol} className="mb-4 relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newSymbol}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Add ticker symbol (e.g., AAPL, TSLA or paste multiple: AAPL\nMSFT\nGOOGL)"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {suggestions.map((item) => (
                        <button
                          key={item.symbol}
                          type="button"
                          onClick={() => handleSelectSuggestion(item.symbol)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-700 transition text-white"
                        >
                          <div className="font-semibold">{item.symbol}</div>
                          <div className="text-sm text-slate-400">{item.name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Add
                </button>
              </div>
            </form>

            {/* Watchlist Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left p-4 text-slate-400 font-medium">Symbol</th>
                      <th className="text-right p-4 text-slate-400 font-medium">Price</th>
                      <th className="text-right p-4 text-slate-400 font-medium">Change</th>
                      <th className="text-right p-4 text-slate-400 font-medium">52W Range</th>
                      <th className="text-center p-4 text-slate-400 font-medium w-12">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedWatchlistItems.map((symbol) => {
                      const quote = quotes.find((q: any) => q.symbol === symbol)
                      const isLoading = isLoadingQuotes
                      const isSelected = selectedSymbol === symbol
                      const isStarred = starredItems.includes(symbol)

                      return (
                        <tr
                          key={symbol}
                          onClick={() => setSelectedSymbol(symbol)}
                          className={`border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer transition ${
                            isSelected ? 'bg-blue-600/10' : ''
                          }`}
                        >
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStarToggle(symbol)
                                }}
                                className="hover:text-yellow-500 transition"
                              >
                                <Star className={`h-5 w-5 ${isStarred ? 'text-yellow-500 fill-yellow-500' : 'text-slate-400'}`} />
                              </button>
                              <span className="font-bold text-white text-lg">{symbol}</span>
                            </div>
                          </td>
                          <td className="text-right p-5">
                            {isLoading ? (
                              <div className="animate-pulse bg-slate-700 h-4 w-16 rounded mx-auto"></div>
                            ) : quote && quote.data.price ? (
                              <span className="font-bold text-white text-lg">
                                ${quote.data.price.toFixed(2)}
                              </span>
                            ) : quote && quote.data.c ? (
                              <span className="font-bold text-white text-lg">
                                ${quote.data.c.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-500">--</span>
                            )}
                          </td>
                          <td className="text-right p-5">
                            {isLoading ? (
                              <div className="animate-pulse bg-slate-700 h-4 w-16 rounded mx-auto"></div>
                            ) : quote ? (
                              <div className={`flex items-center justify-end gap-1 ${
                                quote.data.dp >= 0 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {quote.data.dp >= 0 ? (
                                  <TrendingUp className="h-4 w-4" />
                                ) : (
                                  <TrendingDown className="h-4 w-4" />
                                )}
                                <span className="font-semibold text-base">
                                  {quote.data.dp >= 0 ? '+' : ''}{quote.data.dp?.toFixed(2) || '0.00'}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500">--                              </span>
                            )}
                          </td>
                          <td className="text-right p-5 text-sm">
                            {quote && quote.data.week52Low && quote.data.week52High ? (
                              <span className="text-slate-400">
                                ${quote.data.week52Low?.toFixed(2)} - ${quote.data.week52High?.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-500">--</span>
                            )}
                          </td>
                          <td className="text-center p-5">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // TODO: Add alert functionality
                                }}
                                className="text-blue-500 hover:text-blue-400 transition"
                                title="Set alert"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveSymbol(symbol)
                                }}
                                className="text-red-500 hover:text-red-400 transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Mini Chart - Only Selected Stock */}
          <div className="lg:col-span-6">
            <h2 className="text-xl font-bold text-white mb-4">Selected Stock Chart</h2>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 h-[400px] overflow-hidden">
              <div className="mb-2">
                <span className="font-bold text-white">{selectedSymbol}</span>
              </div>
              <div className="h-[340px] overflow-hidden">
                <TradingViewMiniChart symbol={selectedSymbol} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


