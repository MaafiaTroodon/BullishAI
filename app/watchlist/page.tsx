'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Trash2, TrendingUp, TrendingDown, Star, MoreVertical, Bell } from 'lucide-react'
import useSWR from 'swr'
import { StockChart } from '@/components/charts/StockChart'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const DEFAULT_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX']

export default function WatchlistPage() {
  const [watchlistItems, setWatchlistItems] = useState(DEFAULT_STOCKS)
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
    }
  }, [])

  // Save to localStorage whenever items change
  useEffect(() => {
    if (isClient && typeof window !== 'undefined') {
      localStorage.setItem('watchlistItems', JSON.stringify(watchlistItems))
    }
  }, [watchlistItems, isClient])

  const { data: quotesData, isLoading: isLoadingQuotes } = useSWR(
    `/api/quotes?symbols=${watchlistItems.join(',')}`,
    fetcher,
    { refreshInterval: 30000 }
  )

  const { data: chartData } = useSWR(
    `/api/chart?symbol=${selectedSymbol}&range=5d`,
    fetcher
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

  const quotes = quotesData?.quotes || []

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Watchlist Table */}
          <div className="lg:col-span-2">
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
                      <th className="text-right p-4 text-slate-400 font-medium">Mkt Cap</th>
                      <th className="text-center p-4 text-slate-400 font-medium w-12">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlistItems.map((symbol) => {
                      const quote = quotes.find((q: any) => q.symbol === symbol)
                      const isLoading = isLoadingQuotes
                      const isSelected = selectedSymbol === symbol

                      return (
                        <tr
                          key={symbol}
                          onClick={() => setSelectedSymbol(symbol)}
                          className={`border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer transition ${
                            isSelected ? 'bg-blue-600/10' : ''
                          }`}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button className="hover:text-yellow-500 transition">
                                <Star className="h-4 w-4 text-slate-400" />
                              </button>
                              <span className="font-semibold text-white">{symbol}</span>
                            </div>
                          </td>
                          <td className="text-right p-4">
                            {isLoading ? (
                              <div className="animate-pulse bg-slate-700 h-4 w-16 rounded mx-auto"></div>
                            ) : quote && quote.data.price ? (
                              <span className="font-semibold text-white">
                                ${quote.data.price.toFixed(2)}
                              </span>
                            ) : quote && quote.data.c ? (
                              <span className="font-semibold text-white">
                                ${quote.data.c.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-500">--</span>
                            )}
                          </td>
                          <td className="text-right p-4">
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
                                <span className="font-medium">
                                  {quote.data.dp >= 0 ? '+' : ''}{quote.data.dp?.toFixed(2) || '0.00'}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500">--                              </span>
                            )}
                          </td>
                          <td className="text-right p-4 text-xs">
                            {quote && quote.data.week52Low && quote.data.week52High ? (
                              <span className="text-slate-400">
                                ${quote.data.week52Low?.toFixed(2)} - ${quote.data.week52High?.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-500">--</span>
                            )}
                          </td>
                          <td className="text-right p-4 text-xs">
                            {quote && quote.data.marketCapShort ? (
                              <span 
                                className="text-slate-400"
                                title={quote.data.marketCapFull || ''}
                              >
                                {quote.data.marketCapShort}
                              </span>
                            ) : quote && quote.data.marketCap && quote.data.marketCap > 0 ? (
                              <span className="text-slate-400">
                                {(quote.data.marketCap / 1000000000).toFixed(1)}B
                              </span>
                            ) : (
                              <span className="text-slate-500">--</span>
                            )}
                          </td>
                          <td className="text-center p-4">
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

          {/* Chart Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 sticky top-4">
              <h2 className="text-xl font-bold text-white mb-4">{selectedSymbol}</h2>
              
              {quotes.find((q: any) => q.symbol === selectedSymbol) && (
                <div className="mb-4">
                  <div className="text-3xl font-bold text-white mb-2">
                    ${quotes.find((q: any) => q.symbol === selectedSymbol)?.data.c?.toFixed(2)}
                  </div>
                  <div className={`text-lg ${
                    quotes.find((q: any) => q.symbol === selectedSymbol)?.data.dp >= 0 
                      ? 'text-green-500' 
                      : 'text-red-500'
                  }`}>
                    {quotes.find((q: any) => q.symbol === selectedSymbol)?.data.dp >= 0 ? '+' : ''}
                    {quotes.find((q: any) => q.symbol === selectedSymbol)?.data.dp?.toFixed(2)}%
                  </div>
                </div>
              )}

              {chartData && chartData.data && Array.isArray(chartData.data) && chartData.data.length > 0 ? (
                <StockChart data={chartData.data} symbol={selectedSymbol} />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  Loading chart...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

