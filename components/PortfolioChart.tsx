'use client'

import useSWR from 'swr'
import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r=>r.json())

export function PortfolioChart() {
  const [chartRange, setChartRange] = useState('1m')
  const { data: pf, mutate: mutatePf } = useSWR('/api/portfolio', fetcher, { refreshInterval: 15000 })
  const [localItems, setLocalItems] = useState<any[]>([])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bullish_demo_pf_positions')
      if (raw) setLocalItems(Object.values(JSON.parse(raw)))
      function onUpd(){
        const r = localStorage.getItem('bullish_demo_pf_positions')
        if (r) setLocalItems(Object.values(JSON.parse(r)))
        mutatePf() // Invalidate portfolio cache
      }
      window.addEventListener('portfolioUpdated', onUpd as any)
      return () => window.removeEventListener('portfolioUpdated', onUpd as any)
    } catch {}
  }, [mutatePf])
  const items: any[] = (pf?.items && pf.items.length>0) ? pf.items : localItems

  const { data: charts, isLoading: isLoadingCharts, mutate: mutateCharts, error: chartsError } = useSWR(
    () => items.length>0 ? `/api/_portfolio_chart_proxy?symbols=${items.map(p=>p.symbol).join(',')}&range=${chartRange}` : null,
    fetcher,
    { 
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      refreshInterval: 30000,
      onError: (err) => {
        console.error('Chart fetch error:', err)
      },
      onSuccess: (data) => {
        console.log('Chart data received:', Object.keys(data || {}), items.map(p => p.symbol))
      }
    }
  )

  // Invalidate chart cache when portfolio updates
  useEffect(() => {
    function onPortfolioUpdate() {
      mutateCharts()
    }
    window.addEventListener('portfolioUpdated', onPortfolioUpdate as any)
    return () => window.removeEventListener('portfolioUpdated', onPortfolioUpdate as any)
  }, [mutateCharts])

  // Expect charts: { [symbol]: [{t,c}] }
  const points = useMemo(() => {
    if (!items || items.length === 0) return []
    
    // Calculate current portfolio value for fallback
    let currentPortfolioValue = 0
    for (const pos of items) {
      if (typeof pos.totalShares === 'number' && pos.totalShares > 0) {
        // Try to get current price from enriched data, or use avgPrice
        const price = pos.currentPrice || pos.avgPrice || 0
        if (price > 0) {
          currentPortfolioValue += pos.totalShares * price
        }
      }
    }
    
    // If we don't have charts data, create a flat line chart with current value
    if (!charts || typeof charts !== 'object' || Object.keys(charts).length === 0) {
      if (currentPortfolioValue > 0) {
        const now = Date.now()
        const rangeMs: Record<string, number> = {
          '1h': 60 * 60 * 1000,
          '1d': 24 * 60 * 60 * 1000,
          '3d': 3 * 24 * 60 * 60 * 1000,
          '1week': 7 * 24 * 60 * 60 * 1000,
          '3m': 90 * 24 * 60 * 60 * 1000,
          '6m': 180 * 24 * 60 * 60 * 1000,
          '1y': 365 * 24 * 60 * 60 * 1000,
        }
        const rangeBack = rangeMs[chartRange] || 30 * 24 * 60 * 60 * 1000
        const startTime = now - rangeBack
        
        // Create multiple points for a smoother line (even if flat)
        const pointCount = 50
        const timeStep = rangeBack / pointCount
        const fallbackPoints = []
        for (let i = 0; i <= pointCount; i++) {
          fallbackPoints.push({
            t: startTime + (i * timeStep),
            value: Number(currentPortfolioValue.toFixed(2))
          })
        }
        return fallbackPoints
      }
      return []
    }
    
    // Get all symbols that have chart data
    const syms = items.map(p => p.symbol).filter((s:string) => {
      const chartData = charts[s]
      return Array.isArray(chartData) && chartData.length > 0
    })
    
    if (syms.length === 0) return []
    
    // Collect all unique timestamps from all stocks
    const allTimestamps = new Set<number>()
    syms.forEach(sym => {
      const data = charts[sym] || []
      data.forEach((p:any) => {
        if (p && typeof p.t === 'number') {
          allTimestamps.add(p.t)
        }
      })
    })
    
    if (allTimestamps.size === 0) return []
    
    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b)
    
    // Helper function to find price at a specific timestamp (with interpolation)
    const getPriceAtTime = (symbol: string, timestamp: number): number | null => {
      const arr = charts[symbol] || []
      if (!Array.isArray(arr) || arr.length === 0) return null
      
      // Find exact match first
      const exact = arr.find((p:any) => p && typeof p.t === 'number' && p.t === timestamp)
      if (exact) {
        const price = exact.c ?? exact.close
        return typeof price === 'number' && price > 0 ? price : null
      }
      
      // Find closest data points for interpolation
      let before: any = null
      let after: any = null
      
      for (const p of arr) {
        if (!p || typeof p.t !== 'number') continue
        const price = p.c ?? p.close
        if (typeof price !== 'number' || price <= 0) continue
        
        if (p.t < timestamp && (!before || p.t > before.t)) {
          before = { t: p.t, price }
        } else if (p.t > timestamp && (!after || p.t < after.t)) {
          after = { t: p.t, price }
        }
      }
      
      // Use before if available, else after, else null
      if (before) return before.price
      if (after) return after.price
      return null
    }
    
    // Calculate portfolio value for each timestamp
    const portfolioPoints = sortedTimestamps.map(timestamp => {
      let totalValue = 0
      let hasData = false
      
      for (const pos of items) {
        const price = getPriceAtTime(pos.symbol, timestamp)
        if (price !== null && typeof pos.totalShares === 'number' && pos.totalShares > 0) {
          totalValue += pos.totalShares * price
          hasData = true
        }
      }
      
      return hasData ? { t: timestamp, value: Number(totalValue.toFixed(2)) } : null
    }).filter((p): p is { t: number; value: number } => p !== null && p.value > 0)
    
    // Ensure we have at least some data points
    if (portfolioPoints.length === 0) {
      console.warn('No portfolio points calculated', { items, charts, syms })
      return []
    }
    
    // If we have very few points, create a chart from current portfolio value
    if (portfolioPoints.length < 2) {
      // Calculate current portfolio value
      let currentTotal = 0
      const now = Date.now()
      
      // Try to get current prices from charts or calculate from avgPrice
      for (const pos of items) {
        const arr = charts[pos.symbol] || []
        let price: number | null = null
        
        if (Array.isArray(arr) && arr.length > 0) {
          // Get the latest price from chart data
          const latest = arr[arr.length - 1]
          price = latest?.c ?? latest?.close ?? null
        }
        
        // If no chart price, use avgPrice as fallback (will show flat line)
        if (price === null || price <= 0) {
          price = pos.avgPrice || 0
        }
        
        if (typeof pos.totalShares === 'number' && pos.totalShares > 0 && price > 0) {
          currentTotal += pos.totalShares * price
        }
      }
      
      if (currentTotal > 0) {
        // Create a simple line chart showing current portfolio value
        // Use the selected range to determine how far back to go
        const rangeMs: Record<string, number> = {
          '1h': 60 * 60 * 1000,
          '1d': 24 * 60 * 60 * 1000,
          '3d': 3 * 24 * 60 * 60 * 1000,
          '1week': 7 * 24 * 60 * 60 * 1000,
          '3m': 90 * 24 * 60 * 60 * 1000,
          '6m': 180 * 24 * 60 * 60 * 1000,
          '1y': 365 * 24 * 60 * 60 * 1000,
        }
        
        const rangeBack = rangeMs[chartRange] || 30 * 24 * 60 * 60 * 1000 // Default 30 days
        const startTime = now - rangeBack
        
        // Create multiple points for a smoother line (even if flat)
        const pointCount = 50
        const timeStep = rangeBack / pointCount
        const fallbackPoints = []
        for (let i = 0; i <= pointCount; i++) {
          fallbackPoints.push({
            t: startTime + (i * timeStep),
            value: Number(currentTotal.toFixed(2))
          })
        }
        return fallbackPoints
      }
    }
    
    // If we still have points, ensure they're sorted and have at least 2 points
    if (portfolioPoints.length > 0) {
      // Ensure chronological order
      portfolioPoints.sort((a, b) => a.t - b.t)
      
      // If we only have 1 point, duplicate it to show a line
      if (portfolioPoints.length === 1) {
        const point = portfolioPoints[0]
        const earlierPoint = { t: point.t - (24 * 60 * 60 * 1000), value: point.value }
        return [earlierPoint, point]
      }
      
      return portfolioPoints
    }
    
    return []
  }, [JSON.stringify(items), JSON.stringify(charts), chartRange])

  const ranges = [
    { label: '1H', value: '1h' },
    { label: '1D', value: '1d' },
    { label: '3D', value: '3d' },
    { label: '1W', value: '1week' },
    { label: '3M', value: '3m' },
    { label: '6M', value: '6m' },
    { label: '1Y', value: '1y' },
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
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400">No positions yet. Buy stocks to see your portfolio value chart.</div>
        ) : isLoadingCharts && !charts && points.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400">Loading chart…</div>
        ) : points.length === 0 && !isLoadingCharts ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="mb-2">No chart data available</p>
              <p className="text-sm text-slate-500">Chart data is loading or unavailable for your holdings.</p>
              <p className="text-xs text-slate-600 mt-2">Holdings: {items.map(p => p.symbol).join(', ')}</p>
              <p className="text-xs text-slate-600 mt-1">
                Charts data: {charts ? Object.keys(charts).map(s => `${s}: ${Array.isArray(charts[s]) ? charts[s].length : 0}`).join(', ') : 'none'}
              </p>
              {chartsError && (
                <p className="text-xs text-red-400 mt-1">Error: {chartsError.message}</p>
              )}
            </div>
          </div>
        ) : points.length === 0 && isLoadingCharts ? (
          <div className="h-full flex items-center justify-center text-slate-400">Loading chart data...</div>
        ) : points.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={points}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
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
                formatter={(v: any) => [`$$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Portfolio Value']}
                labelFormatter={(l: any) => {
                  const date = new Date(l)
                  return date.toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  })
                }}
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '8px' }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#10b981" 
                strokeWidth={2} 
                dot={false}
                animationDuration={300}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">Preparing chart...</div>
        )}
      </div>
    </div>
  )
}


