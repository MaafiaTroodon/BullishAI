'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { StockChart } from '@/components/charts/StockChart'
import { NewsFeed } from '@/components/NewsFeed'
import { GlobalNavbar } from '@/components/GlobalNavbar'
import { TrendingUp, TrendingDown } from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function StockPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [chartRange, setChartRange] = useState(searchParams.get('range') || '1d')

  const symbol = (params?.symbol as string)?.toUpperCase() || 'AAPL'

  const { data, isLoading, error } = useSWR(`/api/stocks/${symbol}?range=${chartRange}`, fetcher, {
    refreshInterval: 15000,
  })

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{quote.symbol}</h1>
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
            </div>
          </div>

          {/* Full Stock Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6 text-sm">
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
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Chart Range Selector */}
        <div className="flex gap-2 mb-6">
          {['1D', '5D', '1M', '6M', '1Y', '5Y'].map((r) => (
            <button
              key={r}
              onClick={() => setChartRange(r.toLowerCase())}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                chartRange === r.toLowerCase()
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Chart */}
        {candles && candles.length > 0 ? (
          <StockChart data={candles} symbol={symbol} range={chartRange} source={chartSource} />
        ) : (
          <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
            <div className="text-center text-slate-400">Chart data not available</div>
          </div>
        )}

        {/* News */}
        <div className="mt-8">
          <NewsFeed symbol={symbol} initialNews={news || []} />
        </div>
      </main>
    </div>
  )
}

