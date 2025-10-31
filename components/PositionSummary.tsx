'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'

type Props = { symbol: string; currentPrice?: number | null }

const fetcher = async (url: string) => {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    const contentType = res.headers.get('content-type')
    
    // Check if response is JSON
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text()
      console.error('Non-JSON response:', text.substring(0, 200))
      throw new Error('Invalid response format')
    }
    
    return res.json()
  } catch (error: any) {
    console.error('Fetcher error:', error)
    throw error
  }
}

export function PositionSummary({ symbol, currentPrice }: Props) {
  const [localPos, setLocalPos] = useState<any | null>(null)
  
  // Fetch from API with SWR for real-time updates
  const { data, isLoading, mutate } = useSWR(
    `/api/portfolio?enrich=1`,
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      onError: (error) => {
        console.error('Portfolio API error:', error)
      }
    }
  )

  // Load from localStorage and listen for portfolio updates
  useEffect(() => {
    function loadFromLocal() {
      try {
        const raw = localStorage.getItem('bullish_demo_pf_positions')
        if (raw) {
          const map = JSON.parse(raw)
          if (map && map[symbol.toUpperCase()]) {
            setLocalPos(map[symbol.toUpperCase()])
          }
        }
      } catch (err) {
        console.error('Error loading local position:', err)
      }
    }
    
    loadFromLocal()
    
    function onUpd() {
      loadFromLocal()
      // Invalidate SWR cache to refresh from API
      if (mutate) {
        mutate()
      }
    }
    
    window.addEventListener('portfolioUpdated', onUpd as any)
    return () => window.removeEventListener('portfolioUpdated', onUpd as any)
  }, [symbol, mutate])

  // Find position for this symbol
  const apiPos = useMemo(() => {
    if (!data?.items) return null
    return data.items.find((p: any) => p.symbol === symbol.toUpperCase()) || null
  }, [data, symbol])

  // Use API position if available, otherwise fall back to localStorage
  const pos = apiPos || localPos

  // Calculate unrealized P/L
  const unreal = useMemo(() => {
    if (!pos || !currentPrice) return { val: 0, pct: 0 }
    const price = currentPrice
    const u = (price - pos.avgPrice) * pos.totalShares
    const base = (pos.totalCost || pos.avgPrice * pos.totalShares) || 0
    return { val: u, pct: base > 0 ? (u / base) * 100 : 0 }
  }, [pos, currentPrice])

  // Calculate total value
  const totalValue = useMemo(() => {
    if (!pos) return 0
    const price = currentPrice || pos.currentPrice || pos.avgPrice || 0
    return price * pos.totalShares
  }, [pos, currentPrice])

  // Calculate cost basis
  const costBasis = useMemo(() => {
    if (!pos) return 0
    return pos.totalCost || pos.avgPrice * pos.totalShares || 0
  }, [pos])

  if (isLoading && !pos) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-xl font-bold text-white mb-4">Your Holding</h3>
        <div className="text-slate-400 text-sm animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h3 className="text-xl font-bold text-white mb-4">Your Holding</h3>
      {!pos ? (
        <div className="text-slate-400 text-sm">No position in {symbol} yet.</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-slate-400 mb-1">Shares</div>
              <div className="text-white font-semibold">{pos.totalShares.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-slate-400 mb-1">Avg Price</div>
              <div className="text-white font-semibold">${pos.avgPrice.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-400 mb-1">Cost Basis</div>
              <div className="text-white font-semibold">${costBasis.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-400 mb-1">Total Value</div>
              <div className="text-white font-semibold">${totalValue.toFixed(2)}</div>
            </div>
          </div>
          
          <div className="pt-3 border-t border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Unrealized P/L</span>
              <span className={`font-semibold ${unreal.val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {unreal.val >= 0 ? '+' : ''}${unreal.val.toFixed(2)} ({unreal.pct >= 0 ? '+' : ''}{unreal.pct.toFixed(2)}%)
              </span>
            </div>
            {(pos.realizedPnl || 0) !== 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Realized P/L</span>
                <span className={`font-semibold ${(pos.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(pos.realizedPnl || 0) >= 0 ? '+' : ''}${(pos.realizedPnl || 0).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2">
              <span className="text-slate-400">Total Return</span>
              <span className={`font-semibold text-lg ${(unreal.val + (pos.realizedPnl || 0)) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(unreal.val + (pos.realizedPnl || 0)) >= 0 ? '+' : ''}${(unreal.val + (pos.realizedPnl || 0)).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


