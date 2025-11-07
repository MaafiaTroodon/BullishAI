'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { safeJsonFetcher } from '@/lib/safeFetch'
import { formatETTime } from '@/lib/marketSession'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function CalendarPage() {
  const [activeTab, setActiveTab] = useState<'dividends' | 'earnings'>('earnings')
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week')

  // Fetch earnings data
  const { data: earningsData, isLoading: isLoadingEarnings, error: earningsError } = useSWR(
    activeTab === 'earnings' ? `/api/calendar/earnings?range=${dateRange}` : null,
    safeJsonFetcher,
    { refreshInterval: 15 * 60 * 1000 } // 15 min cache
  )

  // Fetch dividends data
  const { data: dividendsData, isLoading: isLoadingDividends, error: dividendsError } = useSWR(
    activeTab === 'dividends' ? `/api/calendar/dividends?range=${dateRange}` : null,
    safeJsonFetcher,
    { refreshInterval: 15 * 60 * 1000 } // 15 min cache
  )

  const isLoading = activeTab === 'earnings' ? isLoadingEarnings : isLoadingDividends
  const error = activeTab === 'earnings' ? earningsError : dividendsError
  const data = activeTab === 'earnings' ? earningsData : dividendsData

  return (
    <div className="min-h-screen bg-slate-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Market Calendar</h1>
          <p className="text-slate-400">Upcoming earnings and dividend announcements</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-700" role="tablist">
          <button
            onClick={() => setActiveTab('earnings')}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'earnings'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
            aria-selected={activeTab === 'earnings'}
            role="tab"
          >
            Earnings
          </button>
          <button
            onClick={() => setActiveTab('dividends')}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'dividends'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
            aria-selected={activeTab === 'dividends'}
            role="tab"
          >
            Dividends
          </button>
        </div>

        {/* Date Range Selector */}
        <div className="flex gap-2 mb-6">
          {(['today', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>

        {/* Content */}
        {error ? (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <p className="text-red-400 mb-2">Couldn't load {activeTab} data</p>
            <p className="text-slate-500 text-sm mb-4">{error.message || 'API request failed'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              <div className="h-4 bg-slate-700 rounded w-1/2"></div>
            </div>
          </div>
        ) : !data || (Array.isArray(data.items) && data.items.length === 0) ? (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 text-center">
            <p className="text-slate-400">No {activeTab} data available for the selected period.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(data.items || []).map((item: any, idx: number) => (
              <Link
                key={`${item.symbol}-${idx}`}
                href={`/stocks/${item.symbol}`}
                className="block bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-blue-500 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-white text-lg">{item.symbol}</span>
                      <span className="text-slate-400 text-sm">{item.company || item.name}</span>
                    </div>
                    {activeTab === 'earnings' ? (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-400">
                          Date: <span className="text-white">{formatETTime(new Date(item.date))}</span>
                        </span>
                        {item.estimate && (
                          <span className="text-slate-400">
                            Est: <span className="text-white">${item.estimate}</span>
                          </span>
                        )}
                        {item.actual && (
                          <span className={`${item.actual >= (item.estimate || 0) ? 'text-green-400' : 'text-red-400'}`}>
                            Actual: ${item.actual}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-400">
                          Ex-Date: <span className="text-white">{formatETTime(new Date(item.exDate || item.date))}</span>
                        </span>
                        {item.amount && (
                          <span className="text-slate-400">
                            Amount: <span className="text-white">${item.amount}</span>
                          </span>
                        )}
                        {item.yield && (
                          <span className="text-slate-400">
                            Yield: <span className="text-white">{item.yield}%</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

