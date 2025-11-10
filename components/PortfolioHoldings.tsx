'use client'

import useSWR from 'swr'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { safeJsonFetcher } from '@/lib/safeFetch'
import TradingViewSingleTicker from './TradingViewSingleTicker'
import { useUserId, getUserStorageKey } from '@/hooks/useUserId'

export function PortfolioHoldings() {
  const router = useRouter()
  const userId = useUserId()
  const { data: session } = authClient.useSession()
  const storageKey = getUserStorageKey('bullish_pf_positions', userId)
  const { data, isLoading, error, mutate } = useSWR(
    session?.user ? '/api/portfolio?enrich=1' : null,
    safeJsonFetcher,
    { 
      refreshInterval: session?.user ? 2000 : 0,
      // Don't show error retry to prevent flicker
      shouldRetryOnError: false,
      // Prevent showing loading state during revalidation (SWR will use cached data)
      revalidateIfStale: true,
    }
  )
  const [localItems, setLocalItems] = useState<any[]>([])
  
  useEffect(() => {
    if (!storageKey) {
      setLocalItems([])
      return
    }
    
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const map = JSON.parse(raw)
        // Clean up zero-share positions immediately
        const cleaned: Record<string, any> = {}
        for (const [sym, pos] of Object.entries(map)) {
          if ((pos as any).totalShares > 0) {
            cleaned[sym] = pos
          }
        }
        localStorage.setItem(storageKey, JSON.stringify(cleaned))
        setLocalItems(Object.values(cleaned))
      } else {
        setLocalItems([])
      }
      function onUpd() {
        if (!storageKey) {
          setLocalItems([])
          return
        }
        const r = localStorage.getItem(storageKey)
        if (r) {
          const map = JSON.parse(r)
          // Clean up zero-share positions from localStorage
          const cleaned: Record<string, any> = {}
          for (const [sym, pos] of Object.entries(map)) {
            if ((pos as any).totalShares > 0) {
              cleaned[sym] = pos
            }
          }
          localStorage.setItem(storageKey, JSON.stringify(cleaned))
          setLocalItems(Object.values(cleaned))
        } else {
          setLocalItems([])
        }
        mutate() // Invalidate SWR cache
      }
      window.addEventListener('portfolioUpdated', onUpd as any)
      return () => window.removeEventListener('portfolioUpdated', onUpd as any)
    } catch {
      setLocalItems([])
    }
  }, [mutate, storageKey])
  const [enriched, setEnriched] = useState<any[]>([])
  // Always prioritize API data (even if empty) over localStorage
  // This ensures new users see empty state, not data from localStorage
  const items = data?.items !== undefined ? data.items : localItems
  
  // Filter out zero-share positions immediately
  const filteredItems = items.filter((p:any) => (p.totalShares || 0) > 0)

  // Enrich local-only items with live quotes so value/PNL render correctly
  useEffect(() => {
    let cancelled = false
    async function enrich() {
      if (!filteredItems || filteredItems.length === 0) { setEnriched([]); return }
      // If items already have currentPrice from API, use them (but still filter)
      if (filteredItems[0]?.currentPrice != null) { 
        setEnriched(filteredItems.filter((p:any)=> (p.totalShares||0) > 0))
        return 
      }
      try {
        const out: any[] = []
        await Promise.all(filteredItems.map(async (p:any) => {
          try {
            const r = await fetch(`/api/quote?symbol=${encodeURIComponent(p.symbol)}`, { cache: 'no-store' })
            const j = await r.json()
            const price = j?.data?.price ?? j?.price ?? null
            const totalValue = price ? price * p.totalShares : 0
            const base = p.avgPrice * p.totalShares
            const unreal = price ? (price - p.avgPrice) * p.totalShares : 0
            const unrealPct = base>0 ? (unreal/base)*100 : 0
            out.push({ ...p, currentPrice: price, totalValue, unrealizedPnl: unreal, unrealizedPnlPct: unrealPct })
          } catch {
            out.push({ ...p, currentPrice: null, totalValue: 0, unrealizedPnl: 0, unrealizedPnlPct: 0 })
          }
        }))
        if (!cancelled) setEnriched(out)
      } catch {
        if (!cancelled) setEnriched(filteredItems)
      }
    }
    enrich()
    return () => { cancelled = true }
  }, [JSON.stringify(filteredItems)])

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Holdings</h3>
      </div>
      {isLoading && enriched.length === 0 ? (
        <div className="text-slate-400">Loading positions…</div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-400 mb-2">Couldn't load holdings</p>
          <p className="text-slate-500 text-sm mb-4">{error.message || 'API request failed'}</p>
          <button
            onClick={() => mutate()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Retry
          </button>
        </div>
      ) : enriched.length === 0 ? (
        <div className="text-slate-400">No positions yet. <button onClick={() => router.push('/stocks/AAPL')} className="text-blue-400 hover:text-blue-300 underline">Buy stocks</button> to get started.</div>
      ) : (
        <div className="space-y-3">
          {enriched.map((p:any)=>{
            const price = p.currentPrice || 0
            const totalValue = price * p.totalShares
            const base = p.avgPrice * p.totalShares
            const u = totalValue - base
            const up = base>0 ? (u/base)*100 : 0
            return (
              <div key={p.symbol} className="bg-slate-700/30 rounded-lg p-5 hover-card" data-anim="fade-up" data-anim-distance="16">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6 flex-1">
                    <button
                      onClick={() => router.push(`/stocks/${p.symbol}`)}
                      className="text-white font-bold text-lg hover:text-blue-400 transition cursor-pointer"
                    >
                      {p.symbol}
                    </button>
                    <div className="text-sm text-slate-300">Shares: <span className="text-white font-semibold">{p.totalShares.toFixed(4)}</span></div>
                    <div className="text-sm text-slate-300">Avg: <span className="text-white font-semibold">${p.avgPrice.toFixed(2)}</span></div>
                    <div className="text-sm text-slate-300">Value: <span className="text-white font-semibold">${totalValue.toFixed(2)}</span></div>
                    <div className={`text-sm font-bold ${u>=0?'text-emerald-400':'text-red-400'}`}>
                      ${u.toFixed(2)} ({up>=0?'+':''}{up.toFixed(2)}%)
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <TradingViewSingleTicker symbol={p.symbol} width={300} height={80} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


