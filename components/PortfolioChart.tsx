'use client'

import useSWR from 'swr'
import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, Scatter, ScatterChart } from 'recharts'

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
  const [chartRange, setChartRange] = useState('1m')
  const { data: pf, mutate: mutatePf } = useSWR('/api/portfolio?enrich=1&transactions=1', fetcher, { refreshInterval: 15000 })
  const { data: wallet } = useSWR('/api/wallet', fetcher, { refreshInterval: 30000 })
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
  const transactions: any[] = pf?.transactions || []
  const walletTx: any[] = wallet?.transactions || []

  const { data: charts, isLoading: isLoadingCharts, mutate: mutateCharts, error: chartsError } = useSWR(
    () => items.length>0 ? `/api/_portfolio_chart_proxy?symbols=${items.map(p=>p.symbol).join(',')}&range=${chartRange}` : null,
    fetcher,
    { 
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      refreshInterval: 10000,
      onError: (err) => {
        console.error('Chart fetch error:', err)
      },
      onSuccess: (data) => {
        console.log('Chart data received:', Object.keys(data || {}), items.map(p => p.symbol))
      }
    }
  )

      // Client-side fallback: if proxy returns null/HTML, fetch per-symbol directly
      const [chartsOverride, setChartsOverride] = useState<any | null>(null)
      useEffect(() => {
        let cancelled = false
        async function fetchDirect() {
          if (!items || items.length === 0) { setChartsOverride(null); return }
          if (isLoadingCharts) return
          if (charts && typeof charts === 'object') { setChartsOverride(null); return }
          try {
            const entries = await Promise.all(items.map(async (p:any) => {
              try {
                const r = await fetch(`/api/chart?symbol=${encodeURIComponent(p.symbol)}&range=${encodeURIComponent(chartRange)}`, { cache: 'no-store' })
                const ct = r.headers.get('content-type')||''
                if (!ct.includes('application/json')) return [p.symbol, []]
                const j = await r.json()
                const arr = Array.isArray(j?.data) ? j.data : []
                return [p.symbol, arr]
              } catch {
                return [p.symbol, []]
              }
            }))
            if (!cancelled) setChartsOverride(Object.fromEntries(entries))
          } catch {
            if (!cancelled) setChartsOverride(null)
          }
        }
        fetchDirect()
        return () => { cancelled = true }
      }, [items.map(p=>p.symbol).join(','), chartRange, isLoadingCharts, typeof charts])

  // Invalidate chart cache when portfolio updates
  useEffect(() => {
    function onPortfolioUpdate() {
      mutateCharts()
    }
    window.addEventListener('portfolioUpdated', onPortfolioUpdate as any)
    return () => window.removeEventListener('portfolioUpdated', onPortfolioUpdate as any)
  }, [mutateCharts])

      const chartsEffective = chartsOverride || charts

      // Expect charts: { [symbol]: [{t,c}] }
      const points = useMemo(() => {
    // Filter out zero-share positions immediately
    const activeItems = items.filter((p: any) => (p.totalShares || 0) > 0)
    if (!activeItems || activeItems.length === 0) return []
    
    // Calculate current portfolio value for fallback
    let currentPortfolioValue = 0
    for (const pos of activeItems) {
      if (typeof pos.totalShares === 'number' && pos.totalShares > 0) {
        // Try to get current price from enriched data, or use avgPrice
        const price = pos.currentPrice || pos.avgPrice || 0
        if (price > 0) {
          currentPortfolioValue += pos.totalShares * price
        }
      }
    }
    
    // If we don't have charts data, create a flat line chart with current value
        if (!chartsEffective || typeof chartsEffective !== 'object' || Object.keys(chartsEffective).length === 0) {
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
        const syms = activeItems.map(p => p.symbol).filter((s:string) => {
          const chartData = chartsEffective[s]
      return Array.isArray(chartData) && chartData.length > 0
    })
    
    if (syms.length === 0) return []
    
    // Collect all unique timestamps from all stocks
    const allTimestamps = new Set<number>()
    syms.forEach(sym => {
          const data = chartsEffective[sym] || []
      data.forEach((p:any) => {
        if (p && typeof p.t === 'number') {
          allTimestamps.add(p.t)
        }
      })
    })
    
    if (allTimestamps.size === 0) return []
    
    // Sort timestamps
    let sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b)

    // Determine portfolio start: first wallet deposit or first trade
    let firstEvent = Number.POSITIVE_INFINITY
    if (walletTx && walletTx.length > 0) {
      const firstDep = walletTx.find((t:any)=>t.action==='deposit')
      if (firstDep) firstEvent = Math.min(firstEvent, firstDep.timestamp)
    }
    if (transactions && transactions.length > 0) {
      firstEvent = Math.min(firstEvent, ...transactions.map((t:any)=>t.timestamp||Infinity))
    }
    if (isFinite(firstEvent)) {
      sortedTimestamps = sortedTimestamps.filter(t => t >= firstEvent)
      // Ensure we always include a starting point at firstEvent
      if (sortedTimestamps.length === 0 || sortedTimestamps[0] > firstEvent) {
        sortedTimestamps.unshift(firstEvent)
      }
    }
    
    // Helper function to find price at a specific timestamp (with interpolation)
    const getPriceAtTime = (symbol: string, timestamp: number): number | null => {
          const arr = chartsEffective[symbol] || []
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
    
    // Helper: shares held at time using transaction history (if available)
    const sharesAt = (sym: string, timestamp: number, fallbackShares: number): number => {
      const tx = transactions.filter(t => t.symbol === sym)
      if (tx.length === 0) return fallbackShares
      let shares = 0
      for (const t of tx) {
        if (typeof t.timestamp !== 'number' || t.timestamp > timestamp) continue
        if (t.action === 'buy') shares += t.quantity
        else if (t.action === 'sell') shares -= Math.min(shares, t.quantity)
      }
      return Math.max(0, shares)
    }

    // Wallet cash at time from walletTx
    const cashAt = (timestamp: number): number => {
      let bal = 0
      for (const wt of (walletTx||[])) {
        if ((wt.timestamp||0) <= timestamp) {
          bal += wt.action==='deposit'? wt.amount : -wt.amount
        }
      }
      return Math.max(0, bal)
    }

    // Calculate portfolio value for each timestamp
    const portfolioPoints = sortedTimestamps.map(timestamp => {
      let totalValue = 0
      let hasData = false
      
      for (const pos of activeItems) {
        const price = getPriceAtTime(pos.symbol, timestamp)
        const held = sharesAt(pos.symbol, timestamp, pos.totalShares)
        if (price !== null && typeof held === 'number' && held > 0) {
          totalValue += held * price
          hasData = true
        }
      }
      // include cash balance to reflect deposits/withdrawals as jumps
      totalValue += cashAt(timestamp)
      
      return hasData ? { t: timestamp, value: Number(totalValue.toFixed(2)) } : null
    }).filter((p): p is { t: number; value: number } => p !== null && p.value > 0)
    
    // Ensure we have at least some data points
    if (portfolioPoints.length === 0) {
      console.warn('No portfolio points calculated', { activeItems, charts, syms })
      return []
    }
    
    // If we have very few points, create a chart from current portfolio value
    if (portfolioPoints.length < 2) {
      // Calculate current portfolio value
      let currentTotal = 0
      const now = Date.now()
      
      // Try to get current prices from charts or calculate from avgPrice
      for (const pos of activeItems) {
            const arr = chartsEffective[pos.symbol] || []
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
  }, [JSON.stringify(items), JSON.stringify(charts), chartRange, JSON.stringify(transactions), JSON.stringify(walletTx)])

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
      <div className="h-[360px]">
        {items.filter((p: any) => (p.totalShares || 0) > 0).length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400">No positions yet. Buy stocks to see your portfolio value chart.</div>
        ) : isLoadingCharts && !charts && points.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400">Loading chart…</div>
        ) : points.length === 0 && !isLoadingCharts ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="mb-2">No chart data available</p>
              <p className="text-sm text-slate-500">Chart data is loading or unavailable for your holdings.</p>
              <p className="text-xs text-slate-600 mt-2">Holdings: {items.filter((p: any) => (p.totalShares || 0) > 0).map(p => p.symbol).join(', ')}</p>
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
            <AreaChart 
              data={points}
              margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="pfColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
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
                formatter={(v: any) => [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Portfolio Value']}
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
              <Area 
                type="monotoneX" 
                dataKey="value"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#pfColor)"
                dot={false}
                isAnimationActive
                animationDuration={350}
              />
              {/* Trade markers */}
              {transactions && transactions.length>0 && (
                <Scatter data={transactions.map((tx:any)=>{
                  // find portfolio value at tx timestamp
                  const nearest = points.find(p=>p.t>=tx.timestamp) || points[points.length-1]
                  return { x: tx.timestamp, y: nearest? nearest.value : 0, action: tx.action, symbol: tx.symbol }
                })} shape="circle" fill="#38bdf8" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">Preparing chart...</div>
        )}
      </div>
    </div>
  )
}


