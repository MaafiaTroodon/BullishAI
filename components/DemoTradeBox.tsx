'use client'

import { useEffect, useMemo, useState } from 'react'
import { showToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'

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
  const router = useRouter()
  const [mode, setMode] = useState<'buy'|'sell'>('buy')
  const [subType, setSubType] = useState<'market'|'fraction'>('fraction')
  const [orderType, setOrderType] = useState<'dollars'|'shares'>('dollars')
  const [amount, setAmount] = useState<number>(0)
  const [isSubmitting, setSubmitting] = useState(false)
  
  // Fetch portfolio data with SWR for real-time updates
  const { data: portfolioData, mutate } = useSWR('/api/portfolio?enrich=1', fetcher, { refreshInterval: 2000 })
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
        mutate()
      }
      window.addEventListener('portfolioUpdated', onUpd as any)
      return () => window.removeEventListener('portfolioUpdated', onUpd as any)
    } catch {}
  }, [mutate])
  
  const positions = portfolioData?.items || localItems
  const pos = useMemo(()=> positions.find((p:any)=>p.symbol===symbol.toUpperCase()), [positions, symbol])
  const currentPrice = price ?? null
  const estShares = useMemo(() => {
    if (!currentPrice) return 0
    if (subType==='market') return mode === 'sell' && pos ? pos.totalShares : 1
    if (amount<=0) return 0
    const calculated = orderType==='dollars' ? amount / currentPrice : amount
    // For sell mode, cap at available shares
    if (mode === 'sell' && pos && calculated > pos.totalShares) {
      return pos.totalShares
    }
    return calculated
  }, [amount, orderType, currentPrice, subType, mode, pos])
  const estCost = useMemo(() => {
    if (!currentPrice || estShares<=0) return 0
    return orderType==='dollars' ? amount : estShares * currentPrice
  }, [amount, orderType, currentPrice, estShares])

  async function submit() {
    if (!currentPrice || estShares<=0) return
    // For sell mode, validate we have enough shares
    if (mode === 'sell') {
      if (!pos || pos.totalShares <= 0) {
        showToast('No shares to sell', 'error')
        return
      }
      if (estShares > pos.totalShares) {
        showToast(`You only have ${pos.totalShares.toFixed(4)} shares`, 'error')
        return
      }
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ symbol, action: mode, price: currentPrice, quantity: estShares })
      })
      const j = await res.json()
      if (!res.ok) {
        if (j?.error === 'insufficient_funds') {
          showToast('Insufficient wallet balance. Top up your wallet and try again.', 'error')
          try { window.location.href = '/wallet' } catch {}
        } else if (j?.error === 'insufficient_shares') {
          showToast('Not enough shares to sell.', 'error')
        } else {
          showToast('Trade failed', 'error')
        }
        return
      }
      if (res.ok) {
        // Update local positions
        mutate() // Refresh SWR cache
        try {
          const key = 'bullish_demo_pf_positions'
          const raw = localStorage.getItem(key)
          const map = raw ? JSON.parse(raw) : {}
          // If position has 0 shares, remove it
          if (j.item.totalShares <= 0) {
            delete map[j.item.symbol]
          } else {
            map[j.item.symbol] = j.item
          }
          localStorage.setItem(key, JSON.stringify(map))
          // Sync full snapshot to server
          try {
            const snapshot = Object.values(map).filter((p: any) => (p.totalShares || 0) > 0)
            await fetch('/api/portfolio', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ syncPositions: snapshot }) })
          } catch {}
          
          // Persist transaction history
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
          showToast(
            `${mode === 'buy' ? 'Bought' : 'Sold'} ${estShares.toFixed(4)} shares of ${symbol.toUpperCase()} at $${currentPrice.toFixed(2)}`,
            'success'
          )
        } catch {}
        setAmount(0)
        // Navigate back to dashboard after successful trade
        try { router.push('/dashboard') } catch {}
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
          <button onClick={()=>{ setMode('buy'); mutate() }} className={`px-3 py-1 rounded ${mode==='buy'?'bg-emerald-600 text-white':'text-slate-300'}`}>Buy</button>
          <button onClick={()=>{ setMode('sell'); mutate() }} className={`px-3 py-1 rounded ${mode==='sell'?'bg-red-600 text-white':'text-slate-300'}`}>Sell</button>
        </div>
      </div>
      <div className="text-slate-300 text-sm mb-4">{subType==='market'?'Market': 'Fraction'} {mode}. Stored locally on the server (demo portfolio).</div>

      {/* Position Info - Always visible when in sell mode */}
      {mode === 'sell' && (
        <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
          {pos && pos.totalShares > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-sm">You own: <span className="text-white font-semibold">{pos.totalShares.toFixed(4)} shares</span></span>
              <button 
                onClick={async () => {
                  if (!currentPrice || !pos || pos.totalShares <= 0) {
                    showToast('No shares available to sell', 'error')
                    return
                  }
                  setSubmitting(true)
                  try {
                    const res = await fetch('/api/portfolio', {
                      method: 'POST', headers: { 'Content-Type':'application/json' },
                      body: JSON.stringify({ symbol, action: 'sell', price: currentPrice, quantity: pos.totalShares })
                    })
                    const j = await res.json()
                    if (!res.ok) {
                      if (j?.error === 'insufficient_shares') {
                        showToast('Not enough shares to sell.', 'error')
                      } else {
                        showToast(`Trade failed: ${j?.error || 'Unknown error'}`, 'error')
                      }
                      setSubmitting(false)
                      return
                    }
                    if (res.ok) {
                      mutate()
                      try {
                        const key = 'bullish_demo_pf_positions'
                        const raw = localStorage.getItem(key)
                        const map = raw ? JSON.parse(raw) : {}
                        delete map[symbol.toUpperCase()]
                        localStorage.setItem(key, JSON.stringify(map))
                        await fetch('/api/portfolio', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ syncPositions: Object.values(map).filter((p: any) => (p.totalShares || 0) > 0) }) })
                        
                        const txKey = 'bullish_demo_transactions'
                        const txRaw = localStorage.getItem(txKey)
                        const transactions = txRaw ? JSON.parse(txRaw) : []
                        transactions.push({
                          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                          symbol: symbol.toUpperCase(),
                          action: 'sell',
                          price: currentPrice,
                          quantity: pos.totalShares,
                          timestamp: Date.now(),
                        })
                        localStorage.setItem(txKey, JSON.stringify(transactions))
                        
                        window.dispatchEvent(new CustomEvent('portfolioUpdated', { detail: { symbol: symbol.toUpperCase() } }))
                        showToast(`Sold all ${pos.totalShares.toFixed(4)} shares of ${symbol.toUpperCase()} at $${currentPrice.toFixed(2)}`, 'success')
                      } catch {}
                      try { router.push('/dashboard') } catch {}
                    }
                  } catch (err: any) {
                    showToast(`Error: ${err.message || 'Failed to sell'}`, 'error')
                    setSubmitting(false)
                  }
                }}
                disabled={isSubmitting || !currentPrice || !pos || pos.totalShares <= 0}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Selling...' : `Sell All (${pos.totalShares.toFixed(4)} shares)`}
              </button>
            </div>
          ) : (
            <div className="text-slate-400 text-sm">No position in {symbol} to sell</div>
          )}
        </div>
      )}

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

      <div className="text-slate-400 text-sm mb-4 flex items-center gap-3 flex-wrap">
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

      <button 
        onClick={submit} 
        disabled={
          isSubmitting || 
          !currentPrice || 
          estShares<=0 || 
          (mode === 'sell' && (!pos || pos.totalShares <= 0))
        } 
        className={`w-full py-2 rounded-lg font-semibold transition ${mode==='buy' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'} text-white disabled:opacity-50 disabled:cursor-not-allowed`}
      >
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


