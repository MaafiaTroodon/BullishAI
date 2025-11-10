'use client'

import useSWR from 'swr'
import { useEffect, useMemo, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { safeJsonFetcher } from '@/lib/safeFetch'
import { getMarketSession, getRefreshInterval } from '@/lib/marketSession'
import { useUserId, getUserStorageKey } from '@/hooks/useUserId'

export function PortfolioChart() {
  const userId = useUserId()
  const pathname = usePathname()
  const positionsStorageKey = getUserStorageKey('bullish_pf_positions', userId)
  const transactionsStorageKey = getUserStorageKey('bullish_transactions', userId)
  const walletTxStorageKey = getUserStorageKey('bullish_wallet_transactions', userId)
  
  const [chartRange, setChartRange] = useState('1d') // Default to 1D
  
  // Get market session for dynamic refresh interval
  const session = typeof window !== 'undefined' ? getMarketSession() : { session: 'CLOSED' as const }
  const portfolioRefreshInterval = getRefreshInterval(session.session)
  
  // Update frequently for real-time portfolio value based on market session
  // During market hours: refresh every 15 seconds for live price updates
  // When closed: refresh every 60 seconds
  const { data: pf, mutate: mutatePf } = useSWR('/api/portfolio?enrich=1', safeJsonFetcher, { 
    refreshInterval: portfolioRefreshInterval,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    // Dedupe requests to prevent duplicate fetches during navigation
    dedupingInterval: 2000,
    // Revalidate on mount to ensure fresh data on route changes
    revalidateOnMount: true,
    // Keep previous data during revalidation to prevent $0 flicker
    keepPreviousData: true,
    // Don't show error retry to prevent flicker
    shouldRetryOnError: false,
  })
  
  // Revalidate portfolio data on route change to ensure consistency
  // Use a ref to track last pathname to avoid unnecessary revalidations
  const lastPathnameRef = useRef<string | null>(null)
  useEffect(() => {
    if (userId && pathname !== lastPathnameRef.current) {
      lastPathnameRef.current = pathname
      // Only revalidate if we have existing data (to prevent initial $0 flicker)
      if (pf) {
        mutatePf()
      }
    }
  }, [pathname, userId, mutatePf, pf])
  const [localItems, setLocalItems] = useState<any[]>([])
  
  // Map internal ranges to API ranges (consistent mapping) - REMOVED 1H
  const apiRangeMap: Record<string, string> = {
    '1d': '1d',
    '3d': '3d',
    '1week': '1week',
    '1m': '1M',
    '3m': '3M',
    '6m': '6M',
    '1y': '1Y',
    'ALL': 'ALL'
  }
  
  const apiRange = apiRangeMap[chartRange] || '1d'
  // Determine granularity based on range for better data density
  const gran = chartRange === '1d' || chartRange === '3d' ? '5m' : 
               chartRange === '1week' ? '1h' : '1d'
  
  // Get refresh interval for timeseries (same as portfolio)
  const timeseriesRefreshInterval = getRefreshInterval(session.session)
  
  // Fetch timeseries data - key includes range and gran for proper caching
  // Refresh more frequently during market hours for real-time updates
  const { data: timeseriesData, error: timeseriesError, mutate: mutateTimeseries } = useSWR(
    `/api/portfolio/timeseries?range=${apiRange}&gran=${gran}`,
    safeJsonFetcher,
    { 
      refreshInterval: timeseriesRefreshInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true
    }
  )
  
  // Trigger refresh when portfolio updates (after trades)
  useEffect(() => {
    const handlePortfolioUpdate = () => {
      mutateTimeseries()
    }
    window.addEventListener('portfolioUpdated', handlePortfolioUpdate)
    return () => window.removeEventListener('portfolioUpdated', handlePortfolioUpdate)
  }, [mutateTimeseries])
  
  useEffect(() => {
    if (!positionsStorageKey) {
      setLocalItems([])
      return
    }
    
    try {
      const raw = localStorage.getItem(positionsStorageKey)
      if (raw) setLocalItems(Object.values(JSON.parse(raw)))
      else setLocalItems([])
      function onUpd(){
        if (!positionsStorageKey) {
          setLocalItems([])
          return
        }
        const r = localStorage.getItem(positionsStorageKey)
        if (r) setLocalItems(Object.values(JSON.parse(r)))
        else setLocalItems([])
        mutatePf()
        mutateTimeseries()
      }
      window.addEventListener('portfolioUpdated', onUpd as any)
      return () => window.removeEventListener('portfolioUpdated', onUpd as any)
    } catch {
      setLocalItems([])
    }
  }, [mutatePf, mutateTimeseries, positionsStorageKey])
  
  // Sync transactions on mount
  useEffect(() => {
    if (!userId || !transactionsStorageKey || !walletTxStorageKey || !positionsStorageKey) {
      return
    }
    
    async function syncData() {
      try {
        const txRaw = localStorage.getItem(transactionsStorageKey)
        const walletTxRaw = localStorage.getItem(walletTxStorageKey)
        const positionsRaw = localStorage.getItem(positionsStorageKey)
        
        const syncData: any = {}
        if (txRaw) {
          try {
            syncData.syncTransactions = JSON.parse(txRaw)
          } catch {}
        }
        if (walletTxRaw) {
          try {
            syncData.syncWalletTransactions = JSON.parse(walletTxRaw)
          } catch {}
        }
        if (positionsRaw) {
          try {
            syncData.syncPositions = Object.values(JSON.parse(positionsRaw))
          } catch {}
        }
        
        if (Object.keys(syncData).length > 0) {
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
          await fetch(new URL('/api/portfolio', baseUrl).toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncData)
          })
          mutatePf()
          mutateTimeseries()
        }
      } catch {}
    }
    syncData()
  }, [mutatePf, mutateTimeseries, userId, transactionsStorageKey, walletTxStorageKey, positionsStorageKey])
  
  // Use timeseries data from API as single source of truth (no patching)
  // The API already calculates portfolio value from positions + current quotes
  const points = useMemo(() => {
    if (!timeseriesData?.series || !Array.isArray(timeseriesData.series)) {
      return []
    }
    
    // Map timeseries data directly - trust the API calculation
    return timeseriesData.series.map((p: any) => ({
      t: p.t,
      value: p.portfolioAbs || 0,
      costBasis: p.costBasisAbs || 0,
      netInvested: p.netInvestedAbs || 0,
      deltaFromStart$: p.deltaFromStart$ || 0,
      deltaFromStartPct: p.deltaFromStartPct || 0,
      overallReturn$: p.overallReturn$ || 0,
      overallReturnPct: p.overallReturnPct || 0
    }))
  }, [timeseriesData])

  // Calculate portfolio return from cost basis to determine color (matches PortfolioSummary)
  // Use overall return percentage: (portfolioValue - costBasis) / costBasis * 100
  const portfolioReturn = useMemo(() => {
    if (points.length === 0) return 0
    const lastPoint = points[points.length - 1]
    // Use overall return percentage from cost basis, not range-based delta
    return lastPoint.overallReturnPct || 0
  }, [points])

  const isPositive = portfolioReturn >= 0
  const strokeColor = isPositive ? '#10b981' : '#ef4444'
  
  // Calculate Y-axis domain - only portfolio values (no net invested)
  const yDomain = useMemo(() => {
    if (points.length === 0) return [0, 100]
    const portfolioValues = points.map((p: { value: number }) => p.value).filter((v: number) => v > 0)
    if (portfolioValues.length === 0) return [0, 100]
    const min = Math.min(...portfolioValues)
    const max = Math.max(...portfolioValues)
    const range = max - min || max || 1
    const padding = range * 0.1 // 10% padding for better visibility
    // Never show negative Y-axis unless values are truly negative
    return [Math.max(0, min - padding), max + padding]
  }, [points])

  const ranges = [
    { label: '1D', value: '1d' },
    { label: '3D', value: '3d' },
    { label: '1W', value: '1week' },
    { label: '1M', value: '1m' },
    { label: '3M', value: '3m' },
    { label: '6M', value: '6m' },
    { label: '1Y', value: '1y' },
    { label: 'ALL', value: 'ALL' },
  ]

  // Check if there are actual open positions (not just timeseries data)
  // Always prioritize API data (even if empty) over localStorage
  const currentPositions = pf?.items !== undefined ? pf.items : (localItems || [])
  const hasOpenPositions = currentPositions.some((p: any) => (p.totalShares || 0) > 0)

  const formatXAxis = (t: number) => {
    const date = new Date(t)
    if (chartRange === '1d') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (chartRange === '3d' || chartRange === '1week') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Portfolio Value</h3>
        <div className="flex gap-2">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => setChartRange(r.value)}
              className={`px-3 py-1 text-sm rounded transition ${
                chartRange === r.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[500px]">
        {timeseriesError ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="mb-2 text-red-400">Couldn't load chart data</p>
              <p className="text-sm text-slate-500 mb-4">{timeseriesError.message || 'API request failed'}</p>
              <button
                onClick={() => mutateTimeseries()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Retry
              </button>
            </div>
          </div>
        ) : !hasOpenPositions ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="mb-2">No open positions</p>
              <p className="text-sm text-slate-500">Buy stocks to see your portfolio value chart.</p>
            </div>
          </div>
        ) : !timeseriesData || (timeseriesData.series && timeseriesData.series.length === 0) ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="mb-2">Loading chart data...</p>
              <p className="text-sm text-slate-500">Fetching portfolio history...</p>
            </div>
          </div>
        ) : points.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400">Processing chart data...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={points}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="pfColor-up" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pfColor-down" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="t" 
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatXAxis}
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#94a3b8"
                tickFormatter={(v) => `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                style={{ fontSize: '12px' }}
                domain={yDomain}
              />
              <Tooltip 
                content={({ active, payload, label }: any) => {
                  if (!active || !payload || !payload.length) return null
                  
                  const data = payload[0]?.payload
                  const timestamp = label || data?.t
                  const date = new Date(timestamp)
                  const etDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }))
                  const dayName = etDate.toLocaleDateString('en-US', { weekday: 'short' })
                  const dateStr = etDate.toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  }) + ' ET'
                  
                  const portfolioValue = data?.value || 0
                  const costBasis = data?.costBasis || 0
                  const totalReturn$ = data?.overallReturn$ || 0
                  const totalReturnPct = data?.overallReturnPct || 0
                  
                  // Calculate holdings count from current positions (open holdings only)
                  // Always prioritize API data (even if empty) over localStorage
                  const currentPositions = pf?.items !== undefined ? pf.items : (localItems || [])
                  const holdingsCount = currentPositions.filter((p: any) => (p.totalShares || 0) > 0).length
                  
                  return (
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-xl">
                      <div className="text-xs text-slate-400 mb-2">{dayName}, {dateStr}</div>
                      <div className="space-y-1">
                        <div className="text-sm text-white">
                          <span className="text-slate-400">Portfolio value: </span>
                          <span className="font-semibold">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-slate-400">Total return: </span>
                          {costBasis > 0 ? (
                            <span className={`font-semibold ${totalReturn$ >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {totalReturn$ >= 0 ? '+' : ''}${totalReturn$.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%)
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-400">—</span>
                          )}
                        </div>
                        <div className="text-sm text-white">
                          <span className="text-slate-400">Cost basis: </span>
                          <span className="font-semibold">${costBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="text-sm text-white">
                          <span className="text-slate-400">Holdings: </span>
                          <span className="font-semibold">{holdingsCount}</span>
                        </div>
                      </div>
                    </div>
                  )
                }}
                cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '5 5' }}
              />
              <Area 
                type="monotoneX" 
                dataKey="value"
                stroke={strokeColor}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#pfColor-${isPositive ? 'up' : 'down'})`}
                dot={false}
                isAnimationActive={typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches}
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
