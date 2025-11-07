'use client'

import useSWR from 'swr'
import { useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Line } from 'recharts'
import { safeJsonFetcher } from '@/lib/safeFetch'
import { getMarketSession, getRefreshInterval } from '@/lib/marketSession'

export function PortfolioChart() {
  const [chartRange, setChartRange] = useState('1m')
  // Update every second for real-time portfolio value
  const { data: pf, mutate: mutatePf } = useSWR('/api/portfolio?enrich=1', safeJsonFetcher, { refreshInterval: 1000 })
  const [localItems, setLocalItems] = useState<any[]>([])
  
  // Map internal ranges to API ranges
  const apiRangeMap: Record<string, string> = {
    '1h': '1d',
    '1d': '1d',
    '3d': '3d',
    '1week': '1week',
    '3m': '3M',
    '6m': '6M',
    '1y': '1Y',
    '1m': '1M',
    'ALL': 'ALL'
  }
  
  const apiRange = apiRangeMap[chartRange] || '1M'
  const gran = chartRange === '1h' || chartRange === '1d' || chartRange === '3d' ? '5m' : '1d'
  
  // Get market session for refresh interval
  const session = getMarketSession()
  const refreshInterval = getRefreshInterval(session.session)
  
  // Fetch timeseries data
  const { data: timeseriesData, error: timeseriesError, mutate: mutateTimeseries } = useSWR(
    `/api/portfolio/timeseries?range=${apiRange}&gran=${gran}`,
    safeJsonFetcher,
    { refreshInterval }
  )
  
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
      netInvested: p.netInvestedAbs || 0,
      deltaFromStart$: p.deltaFromStart$ || 0,
      deltaFromStartPct: p.deltaFromStartPct || 0
    }))
  }, [timeseriesData])

  // Calculate portfolio return to determine color
  const portfolioReturn = useMemo(() => {
    if (points.length === 0) return 0
    const lastPoint = points[points.length - 1]
    return lastPoint.deltaFromStartPct || 0
  }, [points])

  const isPositive = portfolioReturn >= 0
  const strokeColor = isPositive ? '#10b981' : '#ef4444'
  
  // Calculate Y-axis domain - include both portfolio value and net invested
  const yDomain = useMemo(() => {
    if (points.length === 0) return [0, 100]
    const portfolioValues = points.map(p => p.value).filter(v => v > 0)
    const investedValues = points.map(p => p.netInvested || 0).filter(v => v > 0)
    const allValues = [...portfolioValues, ...investedValues]
    if (allValues.length === 0) return [0, 100]
    const min = Math.min(...allValues)
    const max = Math.max(...allValues)
    const range = max - min || max || 1
    const padding = range * 0.02 // 2% padding
    // Never show negative Y-axis unless values are truly negative
    return [Math.max(0, min - padding), max + padding]
  }, [points])

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
    if (chartRange === '1h' || chartRange === '1d') {
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
        ) : !timeseriesData || (timeseriesData.series && timeseriesData.series.length === 0) ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="mb-2">No portfolio activity yet</p>
              <p className="text-sm text-slate-500">Make a deposit or buy stocks to see your portfolio value chart.</p>
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
                  const netInvestedToDate = data?.netInvested || 0
                  const deltaFromStart$ = data?.deltaFromStart$ || 0
                  const deltaFromStartPct = data?.deltaFromStartPct || 0
                  const startPortfolioAbs = timeseriesData?.meta?.startPortfolioAbs || 0
                  
                  const rangeLabels: Record<string, string> = {
                    '1h': '1 hour',
                    '1d': '1 day',
                    '3d': '3 days',
                    '1week': '1 week',
                    '1m': '1 month',
                    '3m': '3 months',
                    '6m': '6 months',
                    '1y': '1 year',
                    'ALL': 'all time'
                  }
                  const rangeLabel = rangeLabels[chartRange] || 'selected period'
                  
                  // Calculate change in invested money (from fills) for the selected period
                  const firstPoint = points[0]
                  const firstNetInvested = firstPoint?.netInvested || 0
                  const investedChange$ = netInvestedToDate - firstNetInvested
                  const investedChangePct = firstNetInvested > 0 ? (investedChange$ / firstNetInvested) * 100 : 0
                  
                  return (
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-xl">
                      <div className="text-xs text-slate-400 mb-2">{dayName}, {dateStr}</div>
                      <div className="space-y-1">
                        <div className="text-sm text-white">
                          <span className="text-slate-400">Portfolio value: </span>
                          <span className="font-semibold">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-slate-400">Change ({rangeLabel}): </span>
                          {startPortfolioAbs > 0 && deltaFromStartPct !== 0 ? (
                            <span className={`font-semibold ${deltaFromStart$ >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {deltaFromStart$ >= 0 ? '+' : ''}${deltaFromStart$.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({deltaFromStartPct >= 0 ? '+' : ''}{deltaFromStartPct.toFixed(2)}%)
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-400">
                              ${deltaFromStart$.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (—)
                            </span>
                          )}
                        </div>
                        <div className="text-sm">
                          <span className="text-slate-400">Change in invested money ({rangeLabel}): </span>
                          {firstNetInvested > 0 && investedChange$ !== 0 ? (
                            <span className={`font-semibold ${investedChange$ >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {investedChange$ >= 0 ? '+' : ''}${investedChange$.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({investedChangePct >= 0 ? '+' : ''}{investedChangePct.toFixed(2)}%)
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-400">
                              ${investedChange$.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (—)
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-white">
                          <span className="text-slate-400">Net invested (to date): </span>
                          <span className="font-semibold">${netInvestedToDate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
              <Line
                type="monotoneX"
                dataKey="netInvested"
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
