'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, TrendingUp, TrendingDown, Settings, LogOut } from 'lucide-react'
import useSWR from 'swr'
import { StockChart } from '@/components/charts/StockChart'
import { NewsFeed } from '@/components/NewsFeed'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function Dashboard() {
  const router = useRouter()
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
  const [searchQuery, setSearchQuery] = useState('')
  const [chartRange, setChartRange] = useState('1d')

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
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <TrendingUp className="h-6 w-6 text-blue-500" />
              <span className="ml-2 text-xl font-bold text-white">BullishAI</span>
            </div>
            <nav className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/settings')}
                className="text-slate-400 hover:text-white transition flex items-center gap-2"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button
                onClick={() => {/* Handle sign out */}}
                className="text-slate-400 hover:text-white transition flex items-center gap-2"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search for a stock (e.g., AAPL, TSLA, MSFT)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && searchQuery) {
                  setSelectedSymbol(searchQuery)
                }
              }}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Price Card */}
        {isLoadingQuote ? (
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 animate-pulse">
            <div className="h-8 bg-slate-700 rounded w-24 mb-4"></div>
            <div className="h-12 bg-slate-700 rounded w-32"></div>
          </div>
        ) : quote ? (
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">{quote.symbol}</h2>
              {quote.changePercent >= 0 ? (
                <div className="flex items-center text-green-500">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  <span className="text-xl font-semibold">+{quote.changePercent.toFixed(2)}%</span>
                </div>
              ) : (
                <div className="flex items-center text-red-500">
                  <TrendingDown className="h-5 w-5 mr-2" />
                  <span className="text-xl font-semibold">{quote.changePercent.toFixed(2)}%</span>
                </div>
              )}
            </div>
            <div className="text-4xl font-bold text-white mb-4">
              ${quote.price.toFixed(2)}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-slate-400">Open</div>
                <div className="text-white font-semibold">${quote.open?.toFixed(2) || 'N/A'}</div>
              </div>
              <div>
                <div className="text-slate-400">High</div>
                <div className="text-white font-semibold">${quote.high?.toFixed(2) || 'N/A'}</div>
              </div>
              <div>
                <div className="text-slate-400">Low</div>
                <div className="text-white font-semibold">${quote.low?.toFixed(2) || 'N/A'}</div>
              </div>
              <div>
                <div className="text-slate-400">Previous Close</div>
                <div className="text-white font-semibold">${quote.previousClose?.toFixed(2) || 'N/A'}</div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Chart Section */}
        <div className="mb-8">
          <div className="flex space-x-2 mb-4">
            {['1d', '5d', '1m', '6m', '1y'].map((range) => (
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
          ) : chartApiData && chartApiData.data ? (
            <StockChart data={chartApiData.data} symbol={selectedSymbol} />
          ) : (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 h-[400px] flex items-center justify-center">
              <p className="text-slate-400">No chart data available</p>
            </div>
          )}
        </div>

        {/* News Section */}
        <div className="mb-8">
          {isLoadingNews ? (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <p className="text-slate-400">Loading news...</p>
            </div>
          ) : newsData && newsData.news ? (
            <NewsFeed news={newsData.news} symbol={selectedSymbol} />
          ) : (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <p className="text-slate-400">No news available</p>
            </div>
          )}
        </div>

        {/* Watchlist & AI Insights Placeholder */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Watchlists</h3>
            <p className="text-slate-400">Watchlist functionality coming soon...</p>
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

