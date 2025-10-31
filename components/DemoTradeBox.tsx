'use client'

import { useEffect, useMemo, useState } from 'react'

type Props = {
  symbol: string
  price?: number | null
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    const text = await res.text()
    console.error('Non-JSON response:', text.substring(0, 200))
    throw new Error('Invalid response format')
  }
  return res.json()
}

export function DemoTradeBox({ symbol, price }: Props) {
  const [mode, setMode] = useState<'buy'|'sell'>('buy')
  const [subType, setSubType] = useState<'market'|'fraction'>('fraction')
  const [orderType, setOrderType] = useState<'dollars'|'shares'>('dollars')
  const [amount, setAmount] = useState<number>(0)
  const [isSubmitting, setSubmitting] = useState(false)
  const [positions, setPositions] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/portfolio').then(async r=>{
      const ct = r.headers.get('content-type')||''
      if (!ct.includes('application/json')) { throw new Error('Invalid response format') }
      return r.json()
    }).then(j=>setPositions(j.items||[]))
  },[])

  const pos = useMemo(()=> (positions||[]).find((p:any)=>p.symbol===symbol.toUpperCase()), [positions, symbol])
  const currentPrice = price ?? null
  const estShares = useMemo(() => {
    if (!currentPrice) return 0
    if (subType==='market') return 1
    if (amount<=0) return 0
    return orderType==='dollars' ? amount / currentPrice : amount
  }, [amount, orderType, currentPrice, subType])
  const estCost = useMemo(() => {
    if (!currentPrice || amount<=0) return 0
    return orderType==='dollars' ? amount : amount * currentPrice
  }, [amount, orderType, currentPrice])

  async function submit() {
    if (!currentPrice || estShares<=0) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ symbol, action: mode, price: currentPrice, quantity: estShares })
      })
      const j = await res.json()
      if (res.ok) {
        setPositions((prev:any[])=>{
          const others = (prev||[]).filter(p=>p.symbol!==j.item.symbol)
          return [j.item, ...others]
        })
        // Persist to localStorage for cross-widget visibility
        try {
          const key = 'bullish_demo_pf_positions'
          const raw = localStorage.getItem(key)
          const map = raw ? JSON.parse(raw) : {}
          map[j.item.symbol] = j.item
          localStorage.setItem(key, JSON.stringify(map))
          
          // Also persist transaction history
          const txKey = 'bullish_demo_transactions'
          const txRaw = localStorage.getItem(txKey)
          const transactions = txRaw ? JSON.parse(txRaw) : []
          transactions.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            symbol: symbol.toUpperCase(),
            action: mode,
            price: currentPrice,
            quantity: estShares,
            timestamp: Date.now(),
          })
          localStorage.setItem(txKey, JSON.stringify(transactions))
          
          window.dispatchEvent(new CustomEvent('portfolioUpdated', { detail: { symbol: j.item.symbol } }))
        } catch {}
        setAmount(0)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-bold text-white">Demo Trade</h3>
        <div className="bg-slate-900 rounded-md p-1">
          <button onClick={()=>setMode('buy')} className={`px-3 py-1 rounded ${mode==='buy'?'bg-emerald-600 text-white':'text-slate-300'}`}>Buy</button>
          <button onClick={()=>setMode('sell')} className={`px-3 py-1 rounded ${mode==='sell'?'bg-red-600 text-white':'text-slate-300'}`}>Sell</button>
        </div>
      </div>
      <div className="text-slate-300 text-sm mb-4">{subType==='market'?'Market': 'Fraction'} {mode}. Stored locally on the server (demo portfolio).</div>

      <div className="flex items-center gap-2 mb-4 bg-slate-900 rounded-md p-1 w-fit">
        <button onClick={()=>setSubType('market')} className={`px-3 py-1 rounded ${subType==='market'?'bg-slate-700 text-white':'text-slate-300'}`}>Market (1 share)</button>
        <button onClick={()=>setSubType('fraction')} className={`px-3 py-1 rounded ${subType==='fraction'?'bg-slate-700 text-white':'text-slate-300'}`}>Fraction</button>
      </div>

      {subType==='fraction' && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1">Order in</label>
            <select value={orderType} onChange={(e)=>setOrderType(e.target.value as any)} className="w-full bg-slate-700 text-white rounded-md px-3 py-2 outline-none">
              <option value="dollars">Dollars</option>
              <option value="shares">Shares</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">{orderType==='dollars'?'Amount ($)':'Quantity (shares)'}</label>
            <input type="number" value={amount} onChange={e=>setAmount(Number(e.target.value))} className="w-full bg-slate-700 text-white rounded-md px-3 py-2 outline-none" placeholder="0" />
          </div>
        </div>
      )}

      <div className="text-slate-400 text-sm mb-4 flex items-center gap-3">
        <span>
          Current price: <span className="text-white font-semibold">{currentPrice ? `$${currentPrice.toFixed(2)}` : 'N/A'}</span>
        </span>
        {currentPrice && (
          <div className="flex items-center gap-2">
            <button onClick={()=>{ setMode('buy'); setOrderType('dollars'); setAmount(Number(currentPrice.toFixed(2))) }} className="px-2 py-1 bg-slate-700 text-slate-100 rounded text-xs">Buy @ price</button>
            <button onClick={()=>{ setMode('sell'); setOrderType('dollars'); setAmount(Number(currentPrice.toFixed(2))) }} className="px-2 py-1 bg-slate-700 text-slate-100 rounded text-xs">Sell @ price</button>
          </div>
        )}
        {currentPrice && estShares>0 && (
          <span className="ml-2">Est. Shares: <span className="text-white font-semibold">{estShares.toFixed(4)}</span> • Est. Cost: <span className="text-white font-semibold">${estCost.toFixed(2)}</span></span>
        )}
      </div>

      <button onClick={submit} disabled={isSubmitting || !currentPrice || estShares<=0} className={`w-full py-2 rounded-lg font-semibold ${mode==='buy' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'} text-white disabled:opacity-50`}>
        {isSubmitting ? 'Submitting...' : mode==='buy' ? 'Buy' : 'Sell'} {symbol}
      </button>

      {pos && (
        <div className="mt-4 text-sm text-slate-300">
          <div className="flex items-center justify-between"><span>Position</span><span className="text-white font-semibold">{pos.totalShares.toFixed(4)} sh</span></div>
          <div className="flex items-center justify-between"><span>Avg Cost</span><span className="text-white font-semibold">${pos.avgPrice.toFixed(2)}</span></div>
          {currentPrice && (
            (()=>{
              const u = (currentPrice - pos.avgPrice) * pos.totalShares
              const base = pos.avgPrice * pos.totalShares || 0
              const up = base>0 ? (u/base)*100 : 0
              return (
                <div className="flex items-center justify-between"><span>Unrealized P/L</span><span className={`${u>=0?'text-emerald-400':'text-red-400'} font-semibold`}>${u.toFixed(2)} ({up.toFixed(2)}%)</span></div>
              )
            })()
          )}
          {(()=>{
            const r = pos.realizedPnl
            const rpct = 0 // realized % depends on historical closed cost; omitted here
            return <div className="flex items-center justify-between"><span>Realized P/L</span><span className={`${r>=0?'text-emerald-400':'text-red-400'} font-semibold`}>${r.toFixed(2)}</span></div>
          })()}
        </div>
      )}
    </div>
  )
}


