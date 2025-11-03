'use client'

import useSWR from 'swr'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' })
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    const text = await res.text()
    console.error('Non-JSON response:', text.substring(0, 200))
    throw new Error('Invalid response format')
  }
  return res.json()
}

export function PortfolioHoldings() {
  const router = useRouter()
  const { data, isLoading, mutate } = useSWR('/api/portfolio?enrich=1', fetcher, { refreshInterval: 2000 })
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
  const [enriched, setEnriched] = useState<any[]>([])
  const items = (data?.items && data.items.length>0) ? data.items : localItems

  // Enrich local-only items with live quotes so value/PNL render correctly
  useEffect(() => {
    let cancelled = false
    async function enrich() {
      if (!items || items.length === 0) { setEnriched([]); return }
      // If items already have currentPrice from API, use them
      if (items[0]?.currentPrice != null) { setEnriched(items); return }
      try {
        const out: any[] = []
        await Promise.all(items.filter((p:any)=> (p.totalShares||0) > 0).map(async (p:any) => {
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
        if (!cancelled) setEnriched(items)
      }
    }
    enrich()
    return () => { cancelled = true }
  }, [JSON.stringify(items)])

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Holdings</h3>
      </div>
      {isLoading && enriched.length===0 ? (
        <div className="text-slate-400">Loading positions…</div>
      ) : enriched.length === 0 ? (
        <div className="text-slate-400">No positions yet. <button onClick={() => router.push('/stocks/AAPL')} className="text-blue-400 hover:text-blue-300 underline">Buy stocks</button> to get started.</div>
      ) : (
        <div className="space-y-3">
          {enriched.filter((p:any)=> (p.totalShares||0) > 0).map((p:any)=>{
            const price = p.currentPrice || 0
            const totalValue = price * p.totalShares
            const base = p.avgPrice * p.totalShares
            const u = totalValue - base
            const up = base>0 ? (u/base)*100 : 0
            return (
              <div key={p.symbol} className="bg-slate-700/30 rounded-lg p-4 hover-card" data-anim="fade-up" data-anim-distance="16">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
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
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


