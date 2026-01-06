'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { safeJsonFetcher } from '@/lib/safeFetch'
import { formatETTime } from '@/lib/marketSession'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

function CalendarPageContent() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'dividends' | 'earnings'>('earnings')
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week')
  const [dividendSearch, setDividendSearch] = useState('')

  // Read tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'dividends' || tab === 'earnings') {
      setActiveTab(tab)
    }
  }, [searchParams])

  useEffect(() => {
    // Clear search box when switching tabs or date range
    setDividendSearch('')
  }, [activeTab, dateRange])

  const formatDateOnly = (value?: string) => {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(d)
  }

  // Fetch earnings data
  const { data: earningsData, isLoading: isLoadingEarnings, error: earningsError } = useSWR(
    activeTab === 'earnings' ? `/api/calendar/earnings?range=${dateRange}` : null,
    safeJsonFetcher,
    { refreshInterval: 15 * 60 * 1000 } // 15 min cache
  )
  
  // Map earnings data to items format
  const earningsItems = useMemo(() => {
    if (!earningsData || !earningsData.items) return []
    return earningsData.items.map((e: any) => ({
      symbol: e.symbol,
      company: e.company || e.name,
      date: e.date,
      time: e.time,
      estimate: e.estimate || e.estimated_eps,
      actual: e.actual || e.epsActual,
    }))
  }, [earningsData])

  // Fetch dividends data
  const { data: dividendsData, isLoading: isLoadingDividends, error: dividendsError } = useSWR(
    activeTab === 'dividends' ? `/api/calendar/dividends?range=${dateRange}` : null,
    safeJsonFetcher,
    { refreshInterval: 15 * 60 * 1000 } // 15 min cache
  )
  const { data: dividendsFallback } = useSWR(
    activeTab === 'dividends' && dateRange === 'week' ? '/api/calendar/dividends?range=month' : null,
    safeJsonFetcher,
    { refreshInterval: 15 * 60 * 1000 }
  )

  const isLoading = activeTab === 'earnings' ? isLoadingEarnings : isLoadingDividends
  const error = activeTab === 'earnings' ? earningsError : dividendsError
  const data = activeTab === 'earnings' ? earningsData : dividendsData
  const rawItems = useMemo(() => {
    if (activeTab === 'earnings') {
      return earningsItems
    }
    const primary = Array.isArray(data?.items) ? data.items : []
    if (primary.length > 0) return primary
    if (dateRange === 'week') {
      return Array.isArray(dividendsFallback?.items) ? dividendsFallback.items : []
    }
    return []
  }, [activeTab, earningsItems, data, dateRange, dividendsFallback])
  const filteredItems = useMemo(() => {
    if (activeTab !== 'dividends') {
      return rawItems
    }
    const query = dividendSearch.trim().toLowerCase()
    if (!query) {
      return rawItems
    }
    return rawItems.filter((item: any) => {
      const symbol = (item.symbol || '').toString().toLowerCase()
      const company = (item.company || item.name || '').toString().toLowerCase()
      return symbol.includes(query) || company.includes(query)
    })
  }, [activeTab, rawItems, dividendSearch])

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

        {activeTab === 'dividends' && (
          <div className="mb-6">
            <input
              type="text"
              value={dividendSearch}
              onChange={(e) => setDividendSearch(e.target.value)}
              placeholder="Search dividends by symbol or company"
              className="w-full md:w-80 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        )}

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
        ) : !data || filteredItems.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 text-center">
            {activeTab === 'dividends' && dividendSearch.trim() ? (
              <p className="text-slate-400">
                No dividends match "{dividendSearch.trim()}" for the selected period.
              </p>
            ) : (
              <p className="text-slate-400">No {activeTab} data available for the selected period.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item: any, idx: number) => {
              const symbol = (item.symbol || '').toString().toUpperCase()
              const company = item.company || item.name || symbol

              if (activeTab === 'earnings') {
                const dateLabel = formatDateOnly(item.date)
                const timeLabel = formatETTime(new Date(item.date))
                return (
                  <Link
                    key={`${symbol}-${idx}`}
                    href={`/stocks/${symbol}`}
                    className="block bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-blue-500 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-white text-lg">{symbol}</span>
                          <span className="text-slate-400 text-sm">{company}</span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <span className="text-slate-400">
                            Date:{' '}
                            <span className="text-white">{dateLabel}</span>
                            <span className="text-slate-500"> · </span>
                            <span className="text-white">{timeLabel}</span>
                          </span>
                          {typeof item.estimate === 'number' && (
                            <span className="text-slate-400">
                              Est: <span className="text-white">${item.estimate}</span>
                            </span>
                          )}
                          {typeof item.actual === 'number' && (
                            <span
                              className={`${item.actual >= (item.estimate || 0) ? 'text-green-400' : 'text-red-400'}`}
                            >
                              Actual: ${item.actual}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </div>
                  </Link>
                )
              }

              const amountValue = Number(item.amount ?? item.cash_amount)
              const hasAmount = Number.isFinite(amountValue)
              const amountLabel = hasAmount
                ? amountValue.toFixed(amountValue >= 1 ? 2 : 6)
                : item.amount || item.cash_amount
              const yieldValue = Number(item.yield)
              const hasYield = Number.isFinite(yieldValue)
              const yieldLabel = hasYield ? `${yieldValue.toFixed(2)}` : item.yield
              const currency = item.currency || 'USD'
              const exDate = formatDateOnly(item.exDate || item.date)
              const recordDate = formatDateOnly(item.recordDate)
              const payDate = formatDateOnly(item.payDate)
              const declarationDate = formatDateOnly(item.declarationDate)
              const type = (item.type || '').toString().toUpperCase() || null
              const freqNumber = Number(item.frequency)
              const frequencyLabel = Number.isFinite(freqNumber)
                ? {
                    0: 'One-time',
                    1: 'Annual',
                    2: 'Semiannual',
                    4: 'Quarterly',
                    12: 'Monthly',
                    24: 'Bi-monthly',
                    52: 'Weekly'
                  }[freqNumber] || `${freqNumber}× / yr`
                : null

              return (
                <Link
                  key={`${symbol}-${idx}`}
                  href={`/stocks/${symbol}`}
                  className="block bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-blue-500 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="font-bold text-white text-lg">{symbol}</span>
                        <span className="text-slate-400 text-sm">{company}</span>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-3">
                        <span>
                          <span className="text-slate-500">Ex-Date:</span>{' '}
                          <span className="text-white">{exDate}</span>
                        </span>
                        <span>
                          <span className="text-slate-500">Record:</span>{' '}
                          <span className="text-white">{recordDate}</span>
                        </span>
                        <span>
                          <span className="text-slate-500">Pay:</span>{' '}
                          <span className="text-white">{payDate}</span>
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
                        <span>
                          <span className="text-slate-500">Declared:</span>{' '}
                          <span className="text-white">{declarationDate}</span>
                        </span>
                        <span>
                          <span className="text-slate-500">Amount:</span>{' '}
                          <span className="text-white">
                            {hasAmount ? `$${amountLabel} ${currency}` : '—'}
                          </span>
                        </span>
                        <span>
                          <span className="text-slate-500">Yield:</span>{' '}
                          <span className="text-white">{hasYield ? `${yieldLabel}%` : '—'}</span>
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400 uppercase tracking-wide">
                        {type && <span className="px-2 py-1 bg-slate-700/50 rounded-md">{type}</span>}
                        {frequencyLabel && (
                          <span className="px-2 py-1 bg-slate-700/50 rounded-md">{frequencyLabel}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <CalendarPageContent />
    </Suspense>
  )
}
