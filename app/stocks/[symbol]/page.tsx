'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { NewsFeed } from '@/components/NewsFeed'
import { GlobalNavbar } from '@/components/GlobalNavbar'
import { StockAIInsights } from '@/components/StockAIInsights'
import { TradingViewTechnicalAnalysis } from '@/components/TradingViewTechnicalAnalysis'
import { TradingViewFinancials } from '@/components/TradingViewFinancials'
import TradingViewAdvancedChart from '@/components/TradingViewAdvancedChart'
import { StockAIChat } from '@/components/StockAIChat'
import { DemoTradeBox } from '@/components/DemoTradeBox'
import { PositionSummary } from '@/components/PositionSummary'
import { StockChart } from '@/components/charts/StockChart'
import { TrendingUp, TrendingDown, Star } from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function StockPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [chartRange, setChartRange] = useState(searchParams.get('range') || '1d')
  const [watchlistItems, setWatchlistItems] = useState<string[]>([])
  const [isInWatchlist, setIsInWatchlist] = useState(false)

  const symbol = (params?.symbol as string)?.toUpperCase() || 'AAPL'

  const { data, isLoading, error } = useSWR(`/api/stocks/${symbol}?range=${chartRange}`, fetcher, {
    refreshInterval: 15000,
  })

  // Fetch chart data for custom StockChart - SWR will automatically cache and update
  const { data: chartData, isLoading: chartLoading } = useSWR(
    `/api/chart?symbol=${symbol}&range=${chartRange}`, 
    fetcher,
    {
      keepPreviousData: true, // Keep previous data while loading new data
      revalidateOnFocus: false, // Don't revalidate on window focus
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
    }
  )

  // Load watchlist on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('watchlistItems')
      if (saved) {
        const items = JSON.parse(saved)
        setWatchlistItems(items)
        setIsInWatchlist(items.includes(symbol))
      }
    }
  }, [symbol])

  // Handle watchlist toggle
  const handleWatchlistToggle = () => {
    let newItems = [...watchlistItems]
    if (isInWatchlist) {
      newItems = newItems.filter(s => s !== symbol)
      console.log(`${symbol} removed from watchlist`)
    } else {
      newItems.push(symbol)
      console.log(`${symbol} added to watchlist`)
    }
    setWatchlistItems(newItems)
    setIsInWatchlist(!isInWatchlist)
    localStorage.setItem('watchlistItems', JSON.stringify(newItems))
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error Loading Stock</h1>
          <p className="text-slate-400">{error.message || 'Failed to load stock data'}</p>
        </div>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading {symbol}...</div>
      </div>
    )
  }

  if (!data.quote) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Stock Not Found</h1>
          <p className="text-slate-400">Could not load data for {symbol}</p>
        </div>
      </div>
    )
  }

  const { quote, candles, chartSource, changePctOverRange, news } = data

  return (
    <div className="min-h-screen bg-slate-900">
      <GlobalNavbar />
      
      {/* Header Stats */}
      <div className="bg-slate-800 border-b border-slate-700 py-8">
        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{data.companyName}</h1>
              <p className="text-lg text-slate-400 mb-2">{quote.symbol}</p>
              {quote.changePct !== undefined && (
                quote.changePct >= 0 ? (
                  <div className="flex items-center text-green-500">
                    <TrendingUp className="h-6 w-6 mr-2" />
                    <span className="text-2xl font-semibold">
                      {quote.change >= 0 ? '+' : ''}${quote.change?.toFixed(2)} ({quote.changePct >= 0 ? '+' : ''}{quote.changePct?.toFixed(2)}%)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-500">
                    <TrendingDown className="h-6 w-6 mr-2" />
                    <span className="text-2xl font-semibold">
                      ${quote.change?.toFixed(2)} ({quote.changePct?.toFixed(2)}%)
                    </span>
                  </div>
                )
              )}
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold text-white">${quote.price?.toFixed(2)}</div>
              {quote.source && (
                <div className="text-sm text-slate-400 mt-2">
                  Data: {quote.source}
                </div>
              )}
              <button
                onClick={handleWatchlistToggle}
                className={`mt-4 px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 ${
                  isInWatchlist
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                <Star className={`h-5 w-5 ${isInWatchlist ? 'fill-current' : ''}`} />
                {isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
              </button>
            </div>
          </div>

          {/* Full Stock Info Grid */}
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-6 mt-8 text-base">
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-slate-400 mb-2 text-sm">Open</div>
              <div className="text-white font-semibold text-lg">{quote.open?.toFixed(2) ? `$${quote.open?.toFixed(2)}` : 'N/A'}</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-slate-400 mb-2 text-sm">High</div>
              <div className="text-white font-semibold text-lg">{quote.high?.toFixed(2) ? `$${quote.high?.toFixed(2)}` : 'N/A'}</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-slate-400 mb-2 text-sm">Low</div>
              <div className="text-white font-semibold text-lg">{quote.low?.toFixed(2) ? `$${quote.low?.toFixed(2)}` : 'N/A'}</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-slate-400 mb-2 text-sm">Prev Close</div>
              <div className="text-white font-semibold text-lg">{quote.previousClose?.toFixed(2) ? `$${quote.previousClose?.toFixed(2)}` : 'N/A'}</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-slate-400 mb-2 text-sm">Volume</div>
              <div className="text-white font-semibold text-lg">{quote.volume ? (quote.volume / 1000000).toFixed(1) + 'M' : 'N/A'}</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-slate-400 mb-2 text-sm">P/E Ratio</div>
              <div className="text-white font-semibold text-lg">{quote.peRatio?.toFixed(2) || 'N/A'}</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-slate-400 mb-2 text-sm">52W High</div>
              <div className="text-white font-semibold text-lg">{quote.week52High?.toFixed(2) ? `$${quote.week52High?.toFixed(2)}` : 'N/A'}</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-slate-400 mb-2 text-sm">52W Low</div>
              <div className="text-white font-semibold text-lg">{quote.week52Low?.toFixed(2) ? `$${quote.week52Low?.toFixed(2)}` : 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TradingView Advanced Chart */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-8">
          <div className="h-[600px]">
            <TradingViewAdvancedChart symbol={symbol} />
          </div>
        </div>

        {/* AI Insights, Financials, and Technical Analysis */}
        {quote && (
          <div className="grid lg:grid-cols-2 gap-6 mt-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* AI Insights */}
              <StockAIInsights 
                symbol={symbol} 
                quote={quote} 
                candles={candles || []} 
                news={news || []}
                changePctOverRange={changePctOverRange}
              />
              
              {/* Financials */}
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4">Fundamental Data</h3>
                <TradingViewFinancials symbol={symbol} />
              </div>

              {/* Demo Trade Box */}
              <div>
                <DemoTradeBox symbol={symbol} price={quote.price} />
              </div>
            </div>
            
            {/* Right Column */}
            <div className="space-y-6">
              {/* Technical Analysis + Holding side-by-side */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                  <h3 className="text-xl font-bold text-white mb-4">Technical Analysis</h3>
                  <TradingViewTechnicalAnalysis symbol={symbol} width={360} height={360} />
                </div>
                <PositionSummary symbol={symbol} currentPrice={quote.price} />
              </div>

              {/* Custom StockChart with Range Selection - Below Technical Analysis */}
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  {['1d', '5d', '1m', '3m', '6m', '1y'].map((range) => (
                    <button
                      key={range}
                      onClick={() => setChartRange(range)}
                      disabled={chartLoading && chartRange !== range}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        chartRange === range
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      } ${chartLoading && chartRange !== range ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                </div>
                {chartData && (
                  <StockChart 
                    data={chartData.data || []} 
                    range={chartRange} 
                    source={chartData.source}
                  />
                )}
                {chartLoading && !chartData && (
                  <div className="h-[500px] flex items-center justify-center">
                    <div className="text-slate-400">Loading chart...</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* News */}
        <div className="mt-8">
          <NewsFeed symbol={symbol} initialNews={news || []} />
        </div>

        {/* AI Chat - Fixed Bottom Right */}
        {quote && (
          <StockAIChat symbol={symbol} quote={quote} news={news || []} />
        )}
      </main>
    </div>
  )
}

