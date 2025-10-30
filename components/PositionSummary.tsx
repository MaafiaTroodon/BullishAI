'use client'

import { useEffect, useMemo, useState } from 'react'

type Props = { symbol: string; currentPrice?: number | null }

export function PositionSummary({ symbol, currentPrice }: Props) {
  const [pos, setPos] = useState<any | null>(null)
  useEffect(() => {
    fetch('/api/portfolio').then(r=>r.json()).then(j => {
      const p = (j.items||[]).find((x:any)=>x.symbol===symbol.toUpperCase())
      setPos(p || null)
    })
  }, [symbol])

  const unreal = useMemo(() => {
    if (!pos || !currentPrice) return { val: 0, pct: 0 }
    const u = (currentPrice - pos.avgPrice) * pos.totalShares
    const base = pos.avgPrice * pos.totalShares || 0
    return { val: u, pct: base>0 ? (u/base)*100 : 0 }
  }, [pos, currentPrice])

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h3 className="text-xl font-bold text-white mb-4">Your Holding</h3>
      {!pos ? (
        <div className="text-slate-400 text-sm">No position in {symbol} yet.</div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between"><span className="text-slate-400">Shares</span><span className="text-white font-semibold">{pos.totalShares.toFixed(4)} sh</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-400">Avg Cost</span><span className="text-white font-semibold">${pos.avgPrice.toFixed(2)}</span></div>
          {currentPrice && (
            <div className="flex items-center justify-between"><span className="text-slate-400">Unrealized P/L</span><span className={`${unreal.val>=0?'text-emerald-400':'text-red-400'} font-semibold`}>${unreal.val.toFixed(2)} ({unreal.pct.toFixed(2)}%)</span></div>
          )}
          <div className="flex items-center justify-between"><span className="text-slate-400">Realized P/L</span><span className={`${(pos.realizedPnl||0)>=0?'text-emerald-400':'text-red-400'} font-semibold`}>${(pos.realizedPnl||0).toFixed(2)}</span></div>
        </div>
      )}
    </div>
  )
}


