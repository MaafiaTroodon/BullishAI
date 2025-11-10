'use client'

import { useEffect, useMemo, useState } from 'react'
import { showToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useUserId, getUserStorageKey } from '@/hooks/useUserId'

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
  const userId = useUserId()
  const positionsStorageKey = getUserStorageKey('bullish_pf_positions', userId)
  const transactionsStorageKey = getUserStorageKey('bullish_transactions', userId)
  
  const [mode, setMode] = useState<'buy'|'sell'>('buy')
  const [subType, setSubType] = useState<'market'|'fraction'>('fraction')
  const [orderType, setOrderType] = useState<'dollars'|'shares'>('dollars')
  const [amount, setAmount] = useState<number>(0)
  const [isSubmitting, setSubmitting] = useState(false)
  
  // Fetch portfolio data with SWR for real-time updates
  const { data: portfolioData, mutate } = useSWR('/api/portfolio?enrich=1', fetcher, { 
    refreshInterval: 2000,
    // Don't show error retry to prevent flicker
    shouldRetryOnError: false,
    // Prevent showing loading state during revalidation (SWR will use cached data)
    revalidateIfStale: true,
  })
  const [localItems, setLocalItems] = useState<any[]>([])
  
  useEffect(() => {
    if (!positionsStorageKey) {
      setLocalItems([])
      return
    }
    
    function loadPositions() {
      try {
        const raw = localStorage.getItem(positionsStorageKey)
        if (raw) {
          const map = JSON.parse(raw)
          const items = Object.values(map).filter((p: any) => (p.totalShares || 0) > 0)
          setLocalItems(items)
          console.log('[DemoTradeBox] Loaded positions from localStorage:', items.map((p: any) => `${p.symbol}: ${p.totalShares} shares`))
        } else {
          setLocalItems([])
        }
      } catch (err) {
        console.error('[DemoTradeBox] Error loading positions:', err)
        setLocalItems([])
      }
    }
    
    loadPositions()
    
    function onUpd() {
      loadPositions()
      mutate()
    }
    
    window.addEventListener('portfolioUpdated', onUpd as any)
    return () => window.removeEventListener('portfolioUpdated', onUpd as any)
  }, [mutate, positionsStorageKey])
  
  // Always prioritize API data (even if empty) over localStorage
  // This ensures new users see empty state, not data from localStorage
  const positions = portfolioData?.items !== undefined ? portfolioData.items : localItems
  // Filter out zero-share positions and find the matching symbol (case-insensitive)
  const pos = useMemo(()=> {
    const filtered = positions.filter((p:any) => (p.totalShares || 0) > 0)
    const found = filtered.find((p:any)=>p.symbol?.toUpperCase()===symbol.toUpperCase())
    console.log('[DemoTradeBox] Looking for position:', symbol.toUpperCase(), 'Found:', found ? `${found.symbol}: ${found.totalShares} shares` : 'none', 'Available positions:', filtered.map((p:any)=>`${p.symbol}: ${p.totalShares}`))
    return found || null
  }, [positions, symbol])
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
          showToast(`Not enough shares to sell. You have ${pos?.totalShares?.toFixed(4) || 0} shares.`, 'error')
        } else {
          showToast(`Trade failed: ${j?.error || 'Unknown error'}`, 'error')
        }
        setSubmitting(false)
        return
      }
      if (res.ok) {
        // Immediately reset submitting state - don't wait for async operations
        setSubmitting(false)
        
        // Server returned fresh snapshot - use it directly
        if (j.holdings) {
          // Update local storage with fresh holdings from server
          if (positionsStorageKey) {
            const map: Record<string, any> = {}
            j.holdings.forEach((p: any) => {
              const symbolKey = (p.symbol || '').toUpperCase()
              if (symbolKey && p.totalShares > 0) {
                map[symbolKey] = { ...p, symbol: symbolKey }
              }
            })
            localStorage.setItem(positionsStorageKey, JSON.stringify(map))
            const items = Object.values(map).filter((p: any) => (p.totalShares || 0) > 0)
            setLocalItems(items)
          }
        } else if (j.item) {
          // Fallback: update single position (backward compatibility)
          if (positionsStorageKey) {
            const raw = localStorage.getItem(positionsStorageKey)
            const map = raw ? JSON.parse(raw) : {}
            const symbolKey = (j.item.symbol || symbol).toUpperCase()
            if (j.item.totalShares <= 0) {
              delete map[symbolKey]
            } else {
              map[symbolKey] = { ...j.item, symbol: symbolKey }
            }
            localStorage.setItem(positionsStorageKey, JSON.stringify(map))
            const items = Object.values(map).filter((p: any) => (p.totalShares || 0) > 0)
            setLocalItems(items)
          }
        }
        
        // Persist transaction history
        if (j.transaction && transactionsStorageKey) {
          try {
            const txRaw = localStorage.getItem(transactionsStorageKey)
            const transactions = txRaw ? JSON.parse(txRaw) : []
            const exists = transactions.some((t: any) => 
              t.id === j.transaction.id || 
              (t.timestamp === j.transaction.timestamp && t.symbol === j.transaction.symbol && t.action === j.transaction.action)
            )
            if (!exists) {
              transactions.push(j.transaction)
              localStorage.setItem(transactionsStorageKey, JSON.stringify(transactions))
            }
          } catch {}
        }
        
        // Invalidate all SWR caches to force fresh fetch from DB
        // Use optimistic update with fresh data from server
        mutate(async () => {
          // Fetch fresh data from server
          const freshRes = await fetch('/api/portfolio?enrich=1', { cache: 'no-store' })
          if (freshRes.ok) {
            return freshRes.json()
          }
          return portfolioData // Fallback to current data
        }, {
          // Optimistically update with server response data
          optimisticData: portfolioData ? {
            ...portfolioData,
            items: j.holdings || (j.item ? [j.item] : portfolioData.items),
            wallet: j.wallet || portfolioData.wallet,
          } : undefined,
          // Revalidate in background
          revalidate: true,
        })
        
        try {
          // Trigger global events for other components (navbar, wallet page, etc.)
          window.dispatchEvent(new CustomEvent('portfolioUpdated', { detail: { symbol: (j.item?.symbol || symbol).toUpperCase() } }))
          window.dispatchEvent(new CustomEvent('walletUpdated'))
        } catch {}
        
        showToast(
          `${mode === 'buy' ? 'Bought' : 'Sold'} ${estShares.toFixed(4)} shares of ${(j.item?.symbol || symbol).toUpperCase()} at $${currentPrice.toFixed(2)}`,
          'success'
        )
        
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
          <button onClick={()=>{ 
            setMode('buy')
            mutate()
            // Reload positions
            if (positionsStorageKey) {
              const raw = localStorage.getItem(positionsStorageKey)
              if (raw) {
                const map = JSON.parse(raw)
                const items = Object.values(map).filter((p: any) => (p.totalShares || 0) > 0)
                setLocalItems(items)
              }
            }
          }} className={`px-3 py-1 rounded ${mode==='buy'?'bg-emerald-600 text-white':'text-slate-300'}`}>Buy</button>
          <button onClick={()=>{ 
            setMode('sell')
            mutate()
            // Reload positions when switching to sell
            if (positionsStorageKey) {
              const raw = localStorage.getItem(positionsStorageKey)
              if (raw) {
                const map = JSON.parse(raw)
                const items = Object.values(map).filter((p: any) => (p.totalShares || 0) > 0)
                setLocalItems(items)
                console.log('[DemoTradeBox] Switched to sell mode, reloaded positions:', items)
              }
            }
          }} className={`px-3 py-1 rounded ${mode==='sell'?'bg-red-600 text-white':'text-slate-300'}`}>Sell</button>
        </div>
      </div>
      <div className="text-slate-300 text-sm mb-4">{subType==='market'?'Market': 'Fraction'} {mode}. Stored locally on the server (demo portfolio).</div>

      {/* Position Info - Always visible when in sell mode */}
      {mode === 'sell' && (
        <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
          {pos && pos.totalShares > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">You own: <span className="text-white font-semibold">{pos.totalShares.toFixed(4)} shares</span></span>
                <button
                  onClick={() => {
                    mutate()
                    if (positionsStorageKey) {
                      const raw = localStorage.getItem(positionsStorageKey)
                      if (raw) {
                        const map = JSON.parse(raw)
                        const items = Object.values(map).filter((p: any) => (p.totalShares || 0) > 0)
                        setLocalItems(items)
                      }
                    }
                  }}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                >
                  Refresh
                </button>
              </div>
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
                      // Immediately reset submitting state
                      setSubmitting(false)
                      
                      mutate()
                      try {
                        if (!positionsStorageKey || !transactionsStorageKey) return
                        
                        const raw = localStorage.getItem(positionsStorageKey)
                        const map = raw ? JSON.parse(raw) : {}
                        const symbolKey = symbol.toUpperCase()
                        delete map[symbolKey]
                        localStorage.setItem(positionsStorageKey, JSON.stringify(map))
                        // Immediately reload positions
                        const items = Object.values(map).filter((p: any) => (p.totalShares || 0) > 0)
                        setLocalItems(items)
                        console.log('[DemoTradeBox] Positions after sell all:', items)
                        
                        const txRaw = localStorage.getItem(transactionsStorageKey)
                        const transactions = txRaw ? JSON.parse(txRaw) : []
                        const transaction = j.transaction || {
                          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                          symbol: symbolKey,
                          action: 'sell',
                          price: currentPrice,
                          quantity: pos.totalShares,
                          timestamp: Date.now(),
                        }
                        // Check if transaction already exists (avoid duplicates)
                        const exists = transactions.some((t: any) => 
                          t.id === transaction.id || 
                          (t.timestamp === transaction.timestamp && t.symbol === transaction.symbol && t.action === transaction.action)
                        )
                        if (!exists) {
                          transactions.push(transaction)
                          localStorage.setItem(transactionsStorageKey, JSON.stringify(transactions))
                        }
                        
                        window.dispatchEvent(new CustomEvent('portfolioUpdated', { detail: { symbol: symbolKey } }))
                        showToast(`Sold all ${pos.totalShares.toFixed(4)} shares of ${symbolKey} at $${currentPrice.toFixed(2)}`, 'success')
                        
                        // Sync to server in background (non-blocking)
                        fetch('/api/portfolio', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ syncPositions: items }) }).catch(() => {})
                      } catch {}
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
            <div className="space-y-2">
              <div className="text-slate-400 text-sm">No position in {symbol.toUpperCase()} to sell</div>
              <div className="text-xs text-slate-500">
                {positions.length > 0 ? (
                  <>Found {positions.length} position(s): {positions.map((p: any) => `${p.symbol} (${p.totalShares} shares)`).join(', ')}</>
                ) : (
                  <>No positions found. Check localStorage or try refreshing.</>
                )}
              </div>
              <button
                onClick={() => {
                  mutate()
                  if (positionsStorageKey) {
                    const raw = localStorage.getItem(positionsStorageKey)
                    if (raw) {
                      const map = JSON.parse(raw)
                      const items = Object.values(map).filter((p: any) => (p.totalShares || 0) > 0)
                      setLocalItems(items)
                      console.log('[DemoTradeBox] Manual refresh - positions:', items)
                    }
                  }
                }}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
              >
                Refresh Positions
              </button>
            </div>
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


