'use client'

import useSWR from 'swr'
import { useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Line } from 'recharts'
import { safeJsonFetcher } from '@/lib/safeFetch'
import { getMarketSession, getRefreshInterval } from '@/lib/marketSession'

export function PortfolioChart() {
  const [chartRange, setChartRange] = useState<'1H' | '1D' | '3D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'>('1M')
  const { data: pf } = useSWR('/api/portfolio', safeJsonFetcher, { refreshInterval: 15000 })
  const [localItems, setLocalItems] = useState<any[]>([])
  
  // Get market session for refresh interval
  const session = getMarketSession()
  const refreshInterval = getRefreshInterval(session.session)
  
  // Fetch portfolio series data
  const { data: seriesData, error: seriesError, mutate: mutateSeries } = useSWR(
    `/api/portfolio/series?range=${chartRange}`,
    safeJsonFetcher,
    { refreshInterval, revalidateOnFocus: false }
  )
  
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bullish_demo_pf_positions')
      if (raw) setLocalItems(Object.values(JSON.parse(raw)))
      function onUpd() {
        const r = localStorage.getItem('bullish_demo_pf_positions')
        if (r) setLocalItems(Object.values(JSON.parse(r)))
        mutateSeries()
      }
      window.addEventListener('portfolioUpdated', onUpd as any)
      return () => window.removeEventListener('portfolioUpdated', onUpd as any)
    } catch {}
  }, [mutateSeries])
  
  const items: any[] = (pf?.items && pf.items.length > 0) ? pf.items : localItems
  const hasPositions = items.some((p: any) => (p.totalShares || 0) > 0)

  // Transform series data for chart
  const points = useMemo(() => {
    if (!seriesData?.series || !Array.isArray(seriesData.series)) {
      return []
    }
    
    return seriesData.series.map((p: any) => ({
      t: p.t,
      pv: p.pv || 0, // Portfolio Value
      nd: p.nd || 0  // Net Deposits
    }))
  }, [seriesData])

  // Calculate change for selected period
  const periodChange = useMemo(() => {
    if (points.length === 0) return { $: 0, pct: 0 }
    const first = points[0]
    const last = points[points.length - 1]
    const delta$ = last.pv - first.pv
    const deltaPct = first.pv > 0 ? (delta$ / first.pv) * 100 : 0
    return { $: delta$, pct: deltaPct }
  }, [points])

  const isPositive = periodChange.$ >= 0
  const strokeColor = isPositive ? '#10b981' : '#ef4444'
  
  // Calculate Y-axis domain - dynamic padding, no hardcoded $100
  const yDomain = useMemo(() => {
    if (points.length === 0) return [0, 100]
    
    const pvValues = points.map(p => p.pv).filter(v => v >= 0)
    if (pvValues.length === 0) return [0, 100]
    
    const minY = Math.min(...pvValues)
    const maxY = Math.max(...pvValues)
    
    // If flat line (all equal), pad ±2%
    if (minY === maxY) {
      const pad = Math.max(maxY * 0.02, 1)
      return [Math.max(0, minY - pad), maxY + pad]
    }
    
    // Apply padding: max((maxY-minY)*0.1, maxY*0.02)
    const range = maxY - minY
    const pad = Math.max(range * 0.1, maxY * 0.02)
    
    return [Math.max(0, minY - pad), maxY + pad]
  }, [points])

  const ranges = [
    { label: '1H', value: '1H' as const },
    { label: '1D', value: '1D' as const },
    { label: '3D', value: '3D' as const },
    { label: '1W', value: '1W' as const },
    { label: '1M', value: '1M' as const },
    { label: '3M', value: '3M' as const },
    { label: '6M', value: '6M' as const },
    { label: '1Y', value: '1Y' as const },
    { label: 'ALL', value: 'ALL' as const },
  ]

  const formatXAxis = (t: number) => {
    const date = new Date(t)
    if (chartRange === '1H' || chartRange === '1D') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
    } else if (chartRange === '3D' || chartRange === '1W') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', timeZone: 'America/New_York' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
    }
  }

  const rangeLabels: Record<string, string> = {
    '1H': '1 hour',
    '1D': '1 day',
    '3D': '3 days',
    '1W': '1 week',
    '1M': '1 month',
    '3M': '3 months',
    '6M': '6 months',
    '1Y': '1 year',
    'ALL': 'all time'
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Portfolio Value</h3>
        <div className="flex gap-2 flex-wrap">
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
        {seriesError ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="mb-2 text-red-400">Couldn't load chart data</p>
              <p className="text-sm text-slate-500 mb-4">{seriesError.message || 'API request failed'}</p>
              <button
                onClick={() => mutateSeries()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Retry
              </button>
            </div>
          </div>
        ) : !hasPositions ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            No positions yet. Buy stocks to see your portfolio value chart.
          </div>
        ) : !seriesData || points.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="mb-2">No price data for this range</p>
              <p className="text-sm text-slate-500">Price data may be unavailable for some symbols.</p>
            </div>
          </div>
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
                  const dayName = etDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' })
                  const dateStr = etDate.toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'America/New_York'
                  }) + ' ET'
                  
                  const portfolioValue = data?.pv || 0
                  const netDepositsToDate = data?.nd || 0
                  
                  // Calculate change for selected period at this point
                  const firstPv = points[0]?.pv || 0
                  const change$ = portfolioValue - firstPv
                  const changePct = firstPv > 0 ? (change$ / firstPv) * 100 : 0
                  
                  return (
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-xl">
                      <div className="text-xs text-slate-400 mb-2">{dayName}, {dateStr}</div>
                      <div className="space-y-1">
                        <div className="text-sm text-white">
                          <span className="text-slate-400">Portfolio value: </span>
                          <span className="font-semibold">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-slate-400">Change ({rangeLabels[chartRange]}): </span>
                          {firstPv > 0 ? (
                            <span className={`font-semibold ${change$ >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {change$ >= 0 ? '+' : ''}${change$.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-400">—</span>
                          )}
                        </div>
                        <div className="text-sm text-white">
                          <span className="text-slate-400">Net deposits (to date): </span>
                          <span className="font-semibold">${netDepositsToDate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  )
                }}
                cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '5 5' }}
              />
              <Area 
                type="monotone" 
                dataKey="pv"
                stroke={strokeColor}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#pfColor-${isPositive ? 'up' : 'down'})`}
                dot={false}
                isAnimationActive={typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches}
                animationDuration={300}
              />
              <Line
                type="monotone"
                dataKey="nd"
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                strokeOpacity={0.6}
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
