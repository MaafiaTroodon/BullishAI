'use client'

import useSWR from 'swr'
import { useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, LineChart } from 'recharts'

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' })
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    // Avoid noisy dev overlay; fallback handled below
    // Return null so the UI can fallback to flat-line from current value
    return null as any
  }
  return res.json()
}

export function PortfolioChart() {
  const [chartRange, setChartRange] = useState('1M')
  
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
  
  const { data: timeseriesData, mutate: mutateTimeseries } = useSWR(
    `/api/portfolio/timeseries?range=${apiRange}&gran=${gran}`,
    fetcher,
    { refreshInterval: 1000 }
  )
  
  const { data: pf, mutate: mutatePf } = useSWR('/api/portfolio?enrich=1&transactions=1', fetcher, { refreshInterval: 1000 })
  const { data: wallet } = useSWR('/api/wallet', fetcher, { refreshInterval: 1000 })
  useEffect(() => {
    function onUpd() {
      mutatePf()
      mutateTimeseries()
    }
    
    // Sync transactions from localStorage on mount
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
          await fetch('/api/portfolio', {
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
    
    window.addEventListener('portfolioUpdated', onUpd as any)
    window.addEventListener('walletUpdated', onUpd as any)
    return () => {
      window.removeEventListener('portfolioUpdated', onUpd as any)
      window.removeEventListener('walletUpdated', onUpd as any)
    }
  }, [mutatePf, mutateTimeseries])

  // Use timeseries data from API
  const points = useMemo(() => {
    if (!timeseriesData?.series || !Array.isArray(timeseriesData.series)) {
      return []
    }
    
    return timeseriesData.series.map((p: any) => ({
      t: p.t,
      value: p.portfolio || 0,
      costBasis: p.costBasis || 0,
      holdings: p.holdings || 0,
      cash: p.cash || 0,
      moneyInvested: p.moneyInvested || 0 // Net deposits to date
    }))
  }, [timeseriesData])

  // Calculate change for selected time range using API meta
  const getRangeChange = useMemo(() => {
    const startPortfolio = timeseriesData?.meta?.startPortfolio || 0
    const startIndex = timeseriesData?.meta?.startIndex || 0
    
    if (points.length === 0 || startPortfolio === 0) {
      return { change: 0, changePct: 0, startValue: 0 }
    }
    
    // Use the start portfolio value from API meta
    return { 
      change: 0, // Will be calculated per hover point
      changePct: 0,
      startValue: startPortfolio
    }
  }, [points, timeseriesData, chartRange])

  // Calculate daily changes for tooltip (for reference, but we'll use range change)
  const getDailyChange = useMemo(() => {
    // Group points by day and calculate change from start of day
    const dayStarts = new Map<number, number>()
    const changes = new Map<number, { change: number; startValue: number }>()
    
    for (const point of points) {
      const date = new Date(point.t)
      const dayKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
      
      if (!dayStarts.has(dayKey)) {
        dayStarts.set(dayKey, point.value)
      }
      
      const dayStart = dayStarts.get(dayKey) || 0
      changes.set(point.t, { change: point.value - dayStart, startValue: dayStart })
    }
    
    return (timestamp: number) => changes.get(timestamp) || { change: 0, startValue: 0 }
  }, [points])

  // Calculate portfolio return to determine color
  const portfolioReturn = useMemo(() => {
    if (points.length < 2) return 0
    const first = points[0]?.value || 0
    const last = points[points.length - 1]?.value || 0
    
    // Simple comparison: if last > first, it's positive (green)
    // If last < first, it's negative (red)
    if (Math.abs(first) < 0.01) {
      // Starting from near zero - check if we're above or below zero
      return last >= 0 ? 0.01 : -0.01
    }
    
    return (last - first) / Math.abs(first)
  }, [points])

  const isPositive = portfolioReturn >= 0
  const strokeColor = isPositive ? '#10b981' : '#ef4444'
  const gradientId = `pfColor-${isPositive ? 'up' : 'down'}`

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
    } else if (chartRange === 'ALL') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
      <div className="h-[360px]">
        {points.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="mb-2">No portfolio activity yet</p>
              <p className="text-sm text-slate-500">Make a deposit or buy stocks to see your portfolio value chart.</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={points}
              margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
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
              />
              <Tooltip 
                content={({ active, payload, label }: any) => {
                  if (!active || !payload || !payload.length) return null
                  
                  const data = payload[0]?.payload
                  const timestamp = label || data?.t
                  const date = new Date(timestamp)
                  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
                  const dateStr = date.toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })
                  const portfolioValue = data?.value || 0
                  const moneyInvested = data?.moneyInvested || 0 // Net deposits to date
                  
                  // Calculate change from start of selected range to this point
                  const startPortfolio = timeseriesData?.meta?.startPortfolio || 0
                  const rangeChange = portfolioValue - startPortfolio
                  const rangeChangePct = startPortfolio > 0 ? (rangeChange / startPortfolio) * 100 : 0
                  
                  // Get range label
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
                          <span className={`font-semibold ${rangeChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {rangeChange >= 0 ? '+' : ''}${rangeChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({rangeChangePct >= 0 ? '+' : ''}{rangeChangePct.toFixed(2)}%)
                          </span>
                        </div>
                        <div className="text-sm text-white">
                          <span className="text-slate-400">Money invested: </span>
                          <span className="font-semibold">${costBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive
                animationDuration={350}
              />
              <Line
                type="monotoneX"
                dataKey="costBasis"
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


