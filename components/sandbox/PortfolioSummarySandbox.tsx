'use client'

import useSWR from 'swr'
import { useEffect, useState, useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { safeJsonFetcher } from '@/lib/safeFetch'

export function PortfolioSummarySandbox() {
  const { data, isLoading, mutate } = useSWR('/api/portfolio?enrich=1', safeJsonFetcher, { refreshInterval: 1000 })
  // Get latest snapshot from timeseries API for header cards
  const { data: timeseriesData } = useSWR('/api/portfolio/timeseries?range=1d&gran=1d', safeJsonFetcher, { refreshInterval: 1000 })
  
  const [localItems, setLocalItems] = useState<any[]>([])
  const [flash, setFlash] = useState<'up'|'down'|null>(null)
  const [prevVal, setPrevVal] = useState<number | null>(null)
  
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bullish_demo_pf_positions')
      if (raw) {
        const map = JSON.parse(raw)
        setLocalItems(Object.values(map))
      }
      function onUpd() {
        const r = localStorage.getItem('bullish_demo_pf_positions')
        if (r) setLocalItems(Object.values(JSON.parse(r)))
        mutate()
      }
      window.addEventListener('portfolioUpdated', onUpd as any)
      return () => window.removeEventListener('portfolioUpdated', onUpd as any)
    } catch {}
  }, [mutate])

  const [enriched, setEnriched] = useState<any[]>([])
  const items = (data?.items && data.items.length > 0) ? data.items : localItems

  useEffect(() => {
    let cancelled = false
    async function enrich() {
      if (!items || items.length === 0) { setEnriched([]); return }
      if (items[0]?.currentPrice != null) { setEnriched(items); return }
      try {
        const out: any[] = []
        await Promise.all(items.map(async (p: any) => {
          try {
            const r = await fetch(`/api/quote?symbol=${encodeURIComponent(p.symbol)}`, { cache: 'no-store' })
            const j = await r.json()
            const price = j?.data?.price ?? j?.price ?? null
            const totalValue = price ? price * p.totalShares : 0
            const base = (p.totalCost || p.avgPrice * p.totalShares) || 0
            const unreal = price ? (price - p.avgPrice) * p.totalShares : 0
            const unrealPct = base > 0 ? (unreal / base) * 100 : 0
            out.push({ 
              ...p, 
              currentPrice: price, 
              totalValue, 
              unrealizedPnl: unreal, 
              unrealizedPnlPct: unrealPct,
              totalCost: p.totalCost || p.avgPrice * p.totalShares 
            })
          } catch {
            out.push({ 
              ...p, 
              currentPrice: null, 
              totalValue: 0, 
              unrealizedPnl: 0, 
              unrealizedPnlPct: 0,
              totalCost: p.totalCost || p.avgPrice * p.totalShares || 0
            })
          }
        }))
        if (!cancelled) setEnriched(out)
      } catch {
        if (!cancelled) setEnriched(items)
      }
    }
    enrich()
    return () => { cancelled = true }
  }, [JSON.stringify(items)])

  const enrichedItems = enriched.length > 0 ? enriched : items
  const activePositions = enrichedItems.filter((p: any) => (p.totalShares || 0) > 0)

  // Calculate portfolio metrics from latest snapshot (prefer timeseries, fallback to positions)
  const metrics = useMemo(() => {
    // Use latest snapshot from timeseries API if available
    if (timeseriesData?.series && Array.isArray(timeseriesData.series) && timeseriesData.series.length > 0) {
      const latest = timeseriesData.series[timeseriesData.series.length - 1]
      const portfolioAbs = latest.portfolioAbs || 0
      const netDepositsAbs = latest.netDepositsAbs || 0
      const totalReturn$ = portfolioAbs - netDepositsAbs
      const totalReturnPercent = netDepositsAbs > 0 ? (totalReturn$ / netDepositsAbs) * 100 : 0
      
      return {
        totalValue: Number(portfolioAbs.toFixed(2)),
        totalCost: Number(netDepositsAbs.toFixed(2)),
        totalReturn: Number(totalReturn$.toFixed(2)),
        totalReturnPercent: Number(totalReturnPercent.toFixed(2)),
        holdingCount: activePositions.length,
        isPositive: totalReturn$ >= 0
      }
    }
    
    // Fallback to position-based calculation
    let totalValue = 0
    let totalCost = 0
    let realizedPnl = 0
    let holdingCount = 0

    activePositions.forEach((p: any) => {
      holdingCount++
      const value = p.totalValue || (p.currentPrice ? p.currentPrice * p.totalShares : 0)
      totalValue += value
      const cost = p.totalCost || (p.avgPrice * p.totalShares) || 0
      totalCost += cost
      if (p.realizedPnl) {
        realizedPnl += p.realizedPnl
      }
    })

    const unrealizedPnl = totalValue - totalCost
    const totalReturn = unrealizedPnl + realizedPnl
    const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0

    return {
      totalValue: Number(totalValue.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      totalReturn: Number(totalReturn.toFixed(2)),
      totalReturnPercent: Number(totalReturnPercent.toFixed(2)),
      holdingCount,
      isPositive: totalReturn >= 0
    }
  }, [timeseriesData, JSON.stringify(activePositions)])

  useEffect(() => {
    if (prevVal === null) { setPrevVal(metrics.totalValue); return }
    if (metrics.totalValue !== prevVal) {
      setFlash(metrics.totalValue > prevVal ? 'up' : 'down')
      setPrevVal(metrics.totalValue)
      const t = setTimeout(()=> setFlash(null), 450)
      return () => clearTimeout(t)
    }
  }, [metrics.totalValue, prevVal])

  if (isLoading && activePositions.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-48 mb-4"></div>
          <div className="h-6 bg-slate-700 rounded w-32"></div>
        </div>
      </div>
    )
  }

  if (metrics.holdingCount === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="text-white text-2xl font-bold mb-2">$0.00</div>
        <div className="text-slate-400 text-sm">No positions yet</div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-slate-400 text-sm mb-1">Total Portfolio Value (Sandbox)</div>
          <div className={`text-white text-4xl font-bold transition-all duration-300 ${flash==='up'?'text-emerald-400':''}${flash==='down'?' text-red-400':''}`}>${metrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        {metrics.totalReturn !== 0 && (
          <div className={`flex items-center gap-1 ${metrics.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {metrics.isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            <div className="text-lg font-semibold">
              {metrics.isPositive ? '+' : ''}{metrics.totalReturnPercent.toFixed(2)}%
            </div>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div>
          <div className="text-slate-400 text-xs mb-1">Cost Basis</div>
          <div className="text-white text-lg font-semibold">${metrics.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-slate-500 text-xs">Money invested</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs mb-1">Total Return</div>
          <div className={`text-lg font-semibold ${metrics.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {metrics.isPositive ? '+' : ''}${metrics.totalReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-slate-500 text-xs">Gain/Loss</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs mb-1">Return %</div>
          <div className={`text-lg font-semibold ${metrics.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {metrics.isPositive ? '+' : ''}{metrics.totalReturnPercent.toFixed(2)}%
          </div>
          <div className="text-slate-500 text-xs">Overall return</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs mb-1">Holdings</div>
          <div className="text-white text-lg font-semibold">{metrics.holdingCount}</div>
          <div className="text-slate-500 text-xs">Number of stocks</div>
        </div>
      </div>
    </div>
  )
}

