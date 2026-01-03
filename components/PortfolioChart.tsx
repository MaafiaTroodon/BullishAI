'use client'

import useSWR from 'swr'
import { useEffect, useMemo, useState, useRef } from 'react'
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { safeJsonFetcher } from '@/lib/safeFetch'
import { getMarketSession, getRefreshInterval } from '@/lib/marketSession'

export function PortfolioChart() {
  const [chartRange, setChartRange] = useState('1d') // Default to 1D
  // Update every second for real-time portfolio value
  const { data: pf, mutate: mutatePf } = useSWR('/api/portfolio?enrich=1', safeJsonFetcher, { refreshInterval: 1000 })
  const [localItems, setLocalItems] = useState<any[]>([])
  const prevPortfolioValueRef = useRef<number | null>(null)
  
  // Map internal ranges to API ranges (consistent mapping)
  const apiRangeMap: Record<string, string> = {
    '1h': '1h',
    '1d': '1d',
    '3d': '3d',
    '1week': '1week',
    '1m': '1m',
    '3m': '3m',
    '6m': '6m',
    '1y': '1y',
    'ALL': 'all'
  }
  
  const apiRange = apiRangeMap[chartRange] || '1d'
  // Determine granularity based on range for better data density
  const gran = chartRange === '1h' ? '1m' :
               chartRange === '1d' || chartRange === '3d' ? '5m' : 
               chartRange === '1week' ? '1h' : '1d'
  
  // Get market session for refresh interval
  const sessionInfo = getMarketSession()
  const baseRefreshInterval = getRefreshInterval(sessionInfo.session)
  // Fast refresh for real-time updates - refresh frequently to show market movements
  const refreshInterval = chartRange === '1h'
    ? 2000 // 2 seconds for 1H view - shows real-time price movements
    : chartRange === '1d'
      ? 5000 // 5 seconds for 1D view
      : chartRange === '3d'
        ? 10000 // 10 seconds for 3D view
        : 30000 // 30 seconds for longer ranges
  
  // Fetch timeseries data - use calculated endpoint that computes from trades and historical prices
  // This shows actual portfolio value over time based on when stocks were bought
  const { data: timeseriesData, error: timeseriesError, mutate: mutateTimeseries } = useSWR(
    `/api/portfolio/timeseries-calculated?range=${apiRange}`,
    safeJsonFetcher,
    { 
      refreshInterval: refreshInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // Also refresh when portfolio data changes (from fast polling)
      onSuccess: () => {
        // Chart will automatically update when timeseriesData changes
      }
    }
  )
  
  // Rapid refresh chart when portfolio totals change (from fast polling)
  useEffect(() => {
    if (pf?.totals?.tpv) {
      const currentValue = pf.totals.tpv
      
      // Refresh chart immediately when portfolio value changes (rapid updates)
      if (prevPortfolioValueRef.current === null || Math.abs(currentValue - prevPortfolioValueRef.current) > 0.01) {
        prevPortfolioValueRef.current = currentValue
        // Refresh chart immediately
        mutateTimeseries()
      }
    }
  }, [pf?.totals?.tpv, mutateTimeseries])
  
  // Trigger refresh when portfolio updates (after trades)
  // This ensures the chart updates immediately when a demo trade is executed
  useEffect(() => {
    const handlePortfolioUpdate = () => {
      mutateTimeseries() // Refresh chart data
      mutatePf() // Refresh portfolio data
    }
    window.addEventListener('portfolioUpdated', handlePortfolioUpdate)
    window.addEventListener('walletUpdated', handlePortfolioUpdate)
    return () => {
      window.removeEventListener('portfolioUpdated', handlePortfolioUpdate)
      window.removeEventListener('walletUpdated', handlePortfolioUpdate)
    }
  }, [mutateTimeseries, mutatePf])
  
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bullish_demo_pf_positions')
      if (raw) setLocalItems(Object.values(JSON.parse(raw)))
      function onUpd(){
        const r = localStorage.getItem('bullish_demo_pf_positions')
        if (r) setLocalItems(Object.values(JSON.parse(r)))
        mutatePf()
        mutateTimeseries()
      }
      window.addEventListener('portfolioUpdated', onUpd as any)
      return () => window.removeEventListener('portfolioUpdated', onUpd as any)
    } catch {}
  }, [mutatePf, mutateTimeseries])
  
  // Sync transactions on mount
  useEffect(() => {
    async function syncData() {
      try {
        const txRaw = localStorage.getItem('bullish_demo_transactions')
        const walletTxRaw = localStorage.getItem('bullish_wallet_transactions')
        const positionsRaw = localStorage.getItem('bullish_demo_pf_positions')
        
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
  }, [mutatePf, mutateTimeseries])
  
  // Use timeseries data from API - calculated from current holdings + prices
  // Each point = (timestamp, portfolioValue) where portfolioValue = sum(shares * price_at_that_time)
  const points = useMemo(() => {
    if (!timeseriesData?.series || !Array.isArray(timeseriesData.series)) {
      return []
    }
    
    type TimeseriesPoint = {
      timestamp: number
      portfolioValue: number
      costBasis: number
      netInvested: number
      deltaFromStart$: number
      deltaFromStartPct: number
      overallReturn$: number
      overallReturnPct: number
      t: number
      value: number
    }

    // Map timeseries data - each point has timestamp (x-axis) and portfolio value (y-axis)
    const mapped: TimeseriesPoint[] = timeseriesData.series.map((p: any) => {
      // Use the portfolio value from the calculated timeseries
      // This is calculated as: sum(shares_i * price_i_at_that_time) for all holdings
      const portfolioVal = p.portfolio || p.portfolioAbs || p.portfolioValue || p.value || 0
      const costBasisVal = p.costBasis || p.costBasisAbs || p.netInvested || p.netInvestedAbs || 0
      
      return {
        timestamp: p.t, // X-axis: timestamp (time)
        portfolioValue: portfolioVal, // Y-axis: portfolio value at this time
        costBasis: costBasisVal,
        netInvested: p.netInvested || p.netInvestedAbs || costBasisVal,
        deltaFromStart$: p.deltaFromStart$ || 0,
        deltaFromStartPct: p.deltaFromStartPct || 0,
        overallReturn$: p.overallReturn$ || 0,
        overallReturnPct: p.overallReturnPct || 0,
        // Keep 't' and 'value' for backward compatibility
        t: p.t,
        value: portfolioVal
      }
    })
    
    const sorted = mapped.sort((a, b) => a.timestamp - b.timestamp)

    // Recharts needs at least two points to render a line
    if (sorted.length === 1) {
      const only = sorted[0]
      sorted.push({
        ...only,
        timestamp: only.timestamp + 60 * 1000,
        t: only.timestamp + 60 * 1000,
      })
    }

    return sorted
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
  
  // Calculate Y-axis domain dynamically from actual portfolio value series data
  // Uses min/max from the data with ~10% padding to show proper graph variation
  const yDomain = useMemo(() => {
    if (points.length === 0) {
      // No data, use fallback based on dashboard totals
      const dashboardTpv = pf?.totals?.tpv || timeseriesData?.totals?.tpv || 0
      if (dashboardTpv > 0) {
        const padding = dashboardTpv * 0.1 // 10% padding
        return [Math.max(0, dashboardTpv - padding), dashboardTpv + padding]
      }
      return [0, 1000000] // Minimal fallback
    }
    
    // Extract all portfolio values from the series
    const portfolioValues = points
      .map((p) => p.portfolioValue ?? p.value ?? 0)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v) && v > 0)
    
    if (portfolioValues.length === 0) {
      // No valid values, use fallback
      const dashboardTpv = pf?.totals?.tpv || timeseriesData?.totals?.tpv || 0
      if (dashboardTpv > 0) {
        const padding = dashboardTpv * 0.1
        return [Math.max(0, dashboardTpv - padding), dashboardTpv + padding]
      }
      return [0, 1000000]
    }
    
    // Calculate min and max from actual data
    const minValue = Math.min(...portfolioValues)
    const maxValue = Math.max(...portfolioValues)
    const range = maxValue - minValue
    
    // Apply ~10% padding: lowerBound ≈ minValue * 0.9, upperBound ≈ maxValue * 1.1
    // If min and max are very close, enforce minimum padding so line doesn't look flat
    const minPadding = Math.max(range * 0.1, minValue * 0.1, 1000) // At least $1000 or 10% of range
    const maxPadding = Math.max(range * 0.1, maxValue * 0.1, 1000) // At least $1000 or 10% of range
    
    const lowerBound = Math.max(0, minValue - minPadding)
    const upperBound = maxValue + maxPadding
    
    return [lowerBound, upperBound]
  }, [points, timeseriesData?.totals, pf?.totals])

  const sectionTimeline = useMemo(() => {
    if (Array.isArray(timeseriesData?.sections) && timeseriesData.sections.length > 0) {
      return timeseriesData.sections.map((ts: any) => Number(ts)).filter((n) => Number.isFinite(n))
    }
    return points.map((p) => p.timestamp)
  }, [timeseriesData?.sections, points])

  const windowStart = Number(timeseriesData?.window?.startTime) || sectionTimeline[0] || points[0]?.timestamp || 0
  const windowEnd = Number(timeseriesData?.window?.endTime) || sectionTimeline[sectionTimeline.length - 1] || points[points.length - 1]?.timestamp || windowStart
  const chartSpanMs = Math.max(windowEnd - windowStart, 1)
  const chartSpanDays = chartSpanMs / (1000 * 60 * 60 * 24)
  const chartSpanYears = chartSpanDays / 365

  const xTicks = useMemo(() => {
    if (sectionTimeline.length === 0) return points.map((p) => p.timestamp)
    
    // Always include first and last timestamps
    const first = sectionTimeline[0]
    const last = sectionTimeline[sectionTimeline.length - 1]
    
    const ticks = buildTicksForRange(chartRange, sectionTimeline, chartSpanYears)
    
    // Ensure first and last are always included
    const result: number[] = []
    if (ticks.length === 0 || ticks[0] !== first) {
      result.push(first)
    }
    ticks.forEach(t => {
      if (t !== first && t !== last) {
        result.push(t)
      }
    })
    if (ticks.length === 0 || ticks[ticks.length - 1] !== last) {
      result.push(last)
    }
    
    // Remove duplicates and sort
    return Array.from(new Set(result)).sort((a, b) => a - b)
  }, [chartRange, sectionTimeline, chartSpanYears, points])

  const ranges = [
    { label: '1H', value: '1h' },
    { label: '1D', value: '1d' },
    { label: '3D', value: '3d' },
    { label: '1W', value: '1week' },
    { label: '1M', value: '1m' },
    { label: '3M', value: '3m' },
    { label: '6M', value: '6m' },
    { label: '1Y', value: '1y' },
    { label: 'ALL', value: 'ALL' },
  ]

  const formatXAxis = (t: number) => {
    const date = new Date(t)
    const now = new Date()
    
    if (chartRange === '1h') {
      // 1H: Show minutes every 5 minutes (e.g., "11:00 AM", "11:05 AM", "11:10 AM", "11:15 AM", "11:20 AM")
      const minutes = date.getMinutes()
      const roundedMinutes = Math.floor(minutes / 5) * 5 // Round to nearest 5 minutes
      const displayDate = new Date(date)
      displayDate.setMinutes(roundedMinutes, 0, 0)
      const hour = displayDate.getHours()
      const minStr = roundedMinutes.toString().padStart(2, '0')
      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      return `${displayHour}:${minStr} ${period}`
    }
    if (chartRange === '1d') {
      // 1D: Show hours (e.g., "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM")
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    }
    if (chartRange === '3d') {
      // 3D: Show day and time (e.g., "Nov 10 12:00", "Nov 10 15:00", "Nov 11 12:00")
      const dayMonth = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })
      return `${dayMonth} ${time}`
    }
    if (chartRange === '1week') {
      // 1W: Show day names (e.g., "Mon", "Tue", "Wed")
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    }
    if (chartRange === '1m') {
      // 1M: Show month and day (e.g., "Nov 1", "Nov 5", "Nov 10")
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    if (chartRange === '3m') {
      // 3M: Show month and day (e.g., "Nov 1", "Nov 15", "Dec 1", "Dec 15")
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    if (chartRange === '6m') {
      // 6M: Show month and day, spaced every ~2 weeks (e.g., "Jun 1", "Jun 15", "Jul 1", "Jul 15")
      const day = date.getDate()
      // Show day only if it's near the start or middle of month
      if (day <= 3 || (day >= 14 && day <= 17)) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
      return date.toLocaleDateString('en-US', { month: 'short' })
    }
    if (chartRange === '1y') {
      // 1Y: Show month and year (e.g., "Jan 2025", "Feb 2025", "Mar 2025")
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    }
    if (chartRange === 'ALL') {
      if (chartSpanYears > 5) {
        return date.getFullYear().toString()
      }
      if (chartSpanYears > 2) {
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
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
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex w-5 h-[3px] rounded-full" style={{ backgroundColor: strokeColor }}></span>
          <span>Portfolio</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex w-5 h-[3px] rounded-full bg-blue-400"></span>
          <span>Cost basis / Net deposits</span>
        </div>
        {points.length > 0 && (
          <div className="flex items-center gap-1 text-slate-500">
            <span>Start:</span>
            <span className="text-slate-300 font-medium">
              ${points[0].portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
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
        ) : !timeseriesData || (timeseriesData.series && timeseriesData.series.length === 0) ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="mb-2">No open positions</p>
              <p className="text-sm text-slate-500">Buy stocks to see your portfolio value chart.</p>
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
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} opacity={0.35} />
              <XAxis 
                dataKey="timestamp" 
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                ticks={xTicks}
                tickFormatter={formatXAxis}
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
                interval={0}
              />
              <YAxis 
                stroke="#94a3b8"
                tickFormatter={(v) => `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                style={{ fontSize: '12px' }}
                domain={yDomain}
              />
              {points.length > 0 && (
                <ReferenceLine
                  y={points[0].portfolioValue}
                  stroke="#475569"
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                />
              )}
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
                  
                  // Use the ACTUAL values at this specific time point from the chart data
                  // For the last point, use dashboard totals (matches summary exactly)
                  // For other points, use calculated values from that time
                  const isLastPoint = data?.t === points[points.length - 1]?.timestamp
                  
                  const portfolioValue = isLastPoint 
                    ? (pf?.totals?.tpv || timeseriesData?.totals?.tpv || data?.portfolioValue || 0)
                    : (data?.portfolioValue || data?.value || data?.portfolio || 0)
                  
                  const costBasis = isLastPoint
                    ? (pf?.totals?.costBasis || timeseriesData?.totals?.costBasis || data?.costBasis || 0)
                    : (data?.costBasis || 0)
                  
                  // Calculate returns - use dashboard totals for last point, calculated for others
                  const totalReturn$ = isLastPoint
                    ? (pf?.totals?.totalReturn ?? timeseriesData?.totals?.totalReturn ?? (portfolioValue - costBasis))
                    : (data?.overallReturn$ ?? (portfolioValue - costBasis))
                  
                  const totalReturnPct = isLastPoint
                    ? (pf?.totals?.totalReturnPct ?? timeseriesData?.totals?.totalReturnPct ?? (costBasis > 0 ? ((portfolioValue - costBasis) / costBasis) * 100 : 0))
                    : (data?.overallReturnPct ?? (costBasis > 0 ? ((portfolioValue - costBasis) / costBasis) * 100 : 0))
                  
                  // Get holdings count from current positions
                  const currentPositions = pf?.items || localItems || []
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
                type="monotone" 
                dataKey="portfolioValue"
                stroke={strokeColor}
                strokeWidth={2.5}
                fillOpacity={0.2}
                fill={`url(#pfColor-${isPositive ? 'up' : 'down'})`}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: strokeColor }}
                isAnimationActive={typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches}
                animationDuration={300}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="costBasis"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="6 4"
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function buildTicksForRange(range: string, sections: number[], spanYears: number): number[] {
  if (sections.length === 0) return []

  switch (range) {
    case '1h':
      // 1H: Show ticks every 5 minutes - sections are 60 (one per minute)
      // Align to 5-minute boundaries (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60)
      const ticks1h: number[] = [sections[0]]
      const startDate = new Date(sections[0])
      const startMinute = startDate.getMinutes()
      
      // Find sections that align to 5-minute boundaries
      for (let i = 1; i < sections.length - 1; i++) {
        const sectionDate = new Date(sections[i])
        const sectionMinute = sectionDate.getMinutes()
        // Check if this section is at a 5-minute boundary (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
        if (sectionMinute % 5 === 0) {
          ticks1h.push(sections[i])
        }
      }
      ticks1h.push(sections[sections.length - 1])
      return ticks1h
    case '1d':
      // 1D: Show hourly ticks (24 sections = 1 per hour, show all or every other)
      // Sections are hourly, so show every section or every 2nd
      const ticks1d: number[] = [sections[0]]
      const step1d = sections.length <= 24 ? 1 : 2 // Show all if <=24, otherwise every 2nd
      for (let i = step1d; i < sections.length - 1; i += step1d) {
        ticks1d.push(sections[i])
      }
      ticks1d.push(sections[sections.length - 1])
      return ticks1d
    case '3d':
      // 3D: Show every ~6 hours (36 sections, show ~12 ticks)
      return filterEvery(sections, Math.max(1, Math.floor(sections.length / 12)))
    case '1week':
      // 1W: Show daily (14 sections = twice per day, show once per day = 7 ticks)
      return filterEvery(sections, 2) // Every 2nd section = daily
    case '1m':
      // 1M: Show every ~2-3 days (30 sections, show ~10-12 ticks)
      return filterEvery(sections, Math.max(1, Math.floor(sections.length / 10)))
    case '3m':
      // 3M: Show every ~7-10 days (show ~8-10 ticks total)
      // Prefer sections at month boundaries or mid-month
      const ticks3m = getMonthTicks(sections)
      // If we have too few ticks, add some mid-month ones
      if (ticks3m.length < 6) {
        return filterEvery(sections, Math.max(1, Math.floor(sections.length / 8)))
      }
      return ticks3m
    case '6m':
      // 6M: Show monthly or bi-weekly (show ~6-8 ticks)
      const ticks6m = getMonthTicks(sections)
      // If we have too few ticks, add some mid-month ones
      if (ticks6m.length < 4) {
        return filterEvery(sections, Math.max(1, Math.floor(sections.length / 6)))
      }
      return ticks6m
    case '1y':
      // 1Y: Show monthly (show ~12 ticks)
      const ticks1y = getMonthTicks(sections)
      // Ensure we have enough ticks - if sections are daily, show monthly
      if (ticks1y.length < 8) {
        // Try to get monthly ticks by checking if month changes
        return getMonthTicks(sections)
      }
      return ticks1y
    case 'ALL':
      return getAllRangeTicks(sections, spanYears)
    default:
      return filterEvery(sections, Math.max(1, Math.floor(sections.length / 10)))
  }
}

function filterEvery(sections: number[], step: number): number[] {
  if (step <= 1) return Array.from(sections)
  const ticks: number[] = []
  for (let i = 0; i < sections.length; i += step) {
    ticks.push(sections[i])
  }
  return ticks
}

function getMonthTicks(sections: number[]): number[] {
  if (sections.length === 0) return []
  const ticks: number[] = [sections[0]]
  for (let i = 1; i < sections.length; i++) {
    const prev = new Date(sections[i - 1])
    const curr = new Date(sections[i])
    if (curr.getMonth() !== prev.getMonth() || curr.getFullYear() !== prev.getFullYear()) {
      ticks.push(sections[i])
    }
  }
  return ticks
}

function getYearTicks(sections: number[]): number[] {
  if (sections.length === 0) return []
  const ticks: number[] = [sections[0]]
  for (let i = 1; i < sections.length; i++) {
    const prev = new Date(sections[i - 1])
    const curr = new Date(sections[i])
    if (curr.getFullYear() !== prev.getFullYear()) {
      ticks.push(sections[i])
    }
  }
  return ticks
}

function getAllRangeTicks(sections: number[], spanYears: number): number[] {
  if (spanYears > 5) {
    return getYearTicks(sections)
  }
  if (spanYears > 2) {
    const monthTicks = getMonthTicks(sections)
    return monthTicks.filter((ts) => {
      const date = new Date(ts)
      return date.getMonth() % 3 === 0 // quarterly labels
    })
  }
  return getMonthTicks(sections)
}
