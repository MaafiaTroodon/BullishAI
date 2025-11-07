'use client'

import useSWR from 'swr'
import { useEffect, useState, useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { MarketSessionBadge } from './MarketSessionBadge'

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())

export function PortfolioSummary() {
  const { data, isLoading, mutate } = useSWR('/api/portfolio?enrich=1', fetcher, { refreshInterval: 15000 })
  const [localItems, setLocalItems] = useState<any[]>([])
  
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
        mutate() // Invalidate SWR cache
      }
      window.addEventListener('portfolioUpdated', onUpd as any)
      return () => window.removeEventListener('portfolioUpdated', onUpd as any)
    } catch {}
  }, [mutate])

  // Enrich local items if API data is not available
  const [enriched, setEnriched] = useState<any[]>([])
  const items = (data?.items && data.items.length > 0) ? data.items : localItems

  useEffect(() => {
    let cancelled = false
    async function enrich() {
      if (!items || items.length === 0) { setEnriched([]); return }
      // If items already have currentPrice from API, use them
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

  // Calculate portfolio metrics
  const metrics = useMemo(() => {
    let totalValue = 0
    let totalCost = 0
    let realizedPnl = 0
    let holdingCount = 0

    enrichedItems.forEach((p: any) => {
      if (p.totalShares > 0) {
        holdingCount++
        // Current value
        const value = p.totalValue || (p.currentPrice ? p.currentPrice * p.totalShares : 0)
        totalValue += value
        
        // Cost basis (money put in)
        const cost = p.totalCost || (p.avgPrice * p.totalShares) || 0
        totalCost += cost
        
        // Realized P/L
        if (p.realizedPnl) {
          realizedPnl += p.realizedPnl
        }
      }
    })

    // Total return = unrealized + realized
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
  }, [JSON.stringify(enrichedItems)])

  if (isLoading && enrichedItems.length === 0) {
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
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <div className="text-slate-400 text-sm">Total Portfolio Value</div>
            <MarketSessionBadge />
          </div>
          <div className="text-white text-4xl font-bold">${metrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
