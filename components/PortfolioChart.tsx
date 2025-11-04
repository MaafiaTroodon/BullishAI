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
  const { data: pf, mutate: mutatePf } = useSWR('/api/portfolio?enrich=1&transactions=1', fetcher, { refreshInterval: 1000 })
  const { data: wallet } = useSWR('/api/wallet', fetcher, { refreshInterval: 1000 })
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

      // Build graph based on transaction history (buy/sell/deposits)
      const points = useMemo(() => {
    const activeItems = items.filter((p: any) => (p.totalShares || 0) > 0)
    
    // Get all events (deposits, withdrawals, buys, sells) sorted by timestamp
    const allEvents: Array<{ timestamp: number; type: 'deposit' | 'withdraw' | 'buy' | 'sell'; amount?: number; symbol?: string; shares?: number; price?: number }> = []
    
    // Add wallet transactions
    if (walletTx && walletTx.length > 0) {
      walletTx.forEach((wt: any) => {
        if (wt.timestamp && wt.action) {
          allEvents.push({
            timestamp: wt.timestamp,
            type: wt.action === 'deposit' ? 'deposit' : 'withdraw',
            amount: wt.amount || 0
          })
        }
      })
    }
    
    // Add trade transactions
    if (transactions && transactions.length > 0) {
      transactions.forEach((tx: any) => {
        if (tx.timestamp && tx.action && tx.symbol) {
          allEvents.push({
            timestamp: tx.timestamp,
            type: tx.action,
            symbol: tx.symbol,
            shares: tx.quantity || 0,
            price: tx.price || 0
          })
        }
      })
    }
    
    // Sort by timestamp
    allEvents.sort((a, b) => a.timestamp - b.timestamp)
    
    if (allEvents.length === 0) {
      // No events yet - show flat line at $0 or current portfolio value
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
      
      // Calculate current portfolio value
      let currentValue = 0
      activeItems.forEach((pos: any) => {
        const price = pos.currentPrice || pos.avgPrice || 0
        if (price > 0 && pos.totalShares > 0) {
          currentValue += pos.totalShares * price
        }
      })
      
      // Add wallet balance
      if (wallet?.balance) {
        currentValue += wallet.balance
      }
      
      // Return flat line at current value (or $0 if no positions)
      const pointCount = 50
      const timeStep = rangeBack / pointCount
      const fallbackPoints = []
      for (let i = 0; i <= pointCount; i++) {
        fallbackPoints.push({
          t: startTime + (i * timeStep),
          value: Number(currentValue.toFixed(2))
        })
      }
      return fallbackPoints
    }
    
    // Get first event timestamp - start graph from there
    const firstEventTime = allEvents[0].timestamp
    const now = Date.now()
    
    // Build portfolio value over time based on transactions
    // Track holdings per symbol: { symbol: { shares, costBasis } }
    const holdings: Record<string, { shares: number; costBasis: number }> = {}
    let cashBalance = 0
    const graphPoints: Array<{ t: number; value: number }> = []
    
    // Add starting point at $0 before first event
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
    const graphStartTime = Math.max(firstEventTime - rangeBack, firstEventTime - (24 * 60 * 60 * 1000)) // At least 1 day before first event
    
    // Add point at graph start ($0)
    graphPoints.push({ t: graphStartTime, value: 0 })
    
    // Process each event chronologically
    for (const event of allEvents) {
      if (event.type === 'deposit') {
        cashBalance += event.amount || 0
      } else if (event.type === 'withdraw') {
        cashBalance -= event.amount || 0
        cashBalance = Math.max(0, cashBalance)
      } else if (event.type === 'buy' && event.symbol && event.shares && event.price) {
        const sym = event.symbol.toUpperCase()
        if (!holdings[sym]) {
          holdings[sym] = { shares: 0, costBasis: 0 }
        }
        holdings[sym].shares += event.shares
        holdings[sym].costBasis += event.shares * event.price
        cashBalance -= event.shares * event.price // Deduct from cash
      } else if (event.type === 'sell' && event.symbol && event.shares && event.price) {
        const sym = event.symbol.toUpperCase()
        if (holdings[sym]) {
          const sellShares = Math.min(event.shares, holdings[sym].shares)
          holdings[sym].shares -= sellShares
          // Update cost basis proportionally
          const sellRatio = sellShares / (holdings[sym].shares + sellShares)
          holdings[sym].costBasis -= holdings[sym].costBasis * sellRatio
          cashBalance += sellShares * event.price // Add proceeds to cash
          
          // Remove symbol if no shares left
          if (holdings[sym].shares <= 0) {
            delete holdings[sym]
          }
        }
      }
      
      // Calculate portfolio value at this event time
      // Use transaction price for the stock being traded, current/avg price for others
      let portfolioValue = cashBalance
      
      // Add value of holdings
      Object.keys(holdings).forEach(sym => {
        const holding = holdings[sym]
        // If this event is for this symbol, use transaction price
        // Otherwise, use avgPrice from current position (or transaction price if available)
        let price = 0
        if (event.symbol && event.symbol.toUpperCase() === sym && event.price) {
          price = event.price
        } else {
          // Find current position or use avgPrice
          const pos = activeItems.find((p: any) => p.symbol === sym)
          if (pos) {
            price = pos.currentPrice || pos.avgPrice || 0
          } else {
            // No current position, but we have holding - use cost basis / shares
            price = holding.costBasis / (holding.shares || 1)
          }
        }
        portfolioValue += holding.shares * price
      })
      
      graphPoints.push({ t: event.timestamp, value: Number(portfolioValue.toFixed(2)) })
    }
    
    // Add current point using current prices
    let currentValue = cashBalance
    activeItems.forEach((pos: any) => {
      const price = pos.currentPrice || pos.avgPrice || 0
      if (price > 0 && pos.totalShares > 0) {
        currentValue += pos.totalShares * price
      }
    })
    
    // Add wallet balance (in case it's not reflected in cashBalance)
    if (wallet?.balance && wallet.balance > cashBalance) {
      currentValue = currentValue - cashBalance + wallet.balance
    }
    
    graphPoints.push({ t: now, value: Number(currentValue.toFixed(2)) })
    
    // Ensure points are sorted by timestamp
    graphPoints.sort((a, b) => a.t - b.t)
    
    // Remove duplicates (same timestamp)
    const uniquePoints: Array<{ t: number; value: number }> = []
    let lastPoint: { t: number; value: number } | null = null
    graphPoints.forEach(point => {
      if (!lastPoint || point.t !== lastPoint.t) {
        uniquePoints.push(point)
        lastPoint = point
      }
    })
    
    return uniquePoints.length > 0 ? uniquePoints : [{ t: now, value: 0 }]
  }, [items, transactions, walletTx, wallet, chartRange])

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


