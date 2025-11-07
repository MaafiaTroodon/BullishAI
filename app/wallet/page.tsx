'use client'

import { useEffect, useState } from 'react'
import { showToast } from '@/components/Toast'

export default function WalletPage() {
  const [balance, setBalance] = useState<number>(0)
  const [amount, setAmount] = useState<string>('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      const r = await fetch(`${baseUrl}/api/wallet`, { cache: 'no-store' })
      if (!r.ok) {
        console.error('Wallet fetch failed:', r.status, r.statusText)
        return
      }
      const j = await r.json()
      setBalance(j.balance || 0)
      // Don't dispatch event here - only dispatch after actual transactions
    } catch (err) {
      console.error('Error refreshing wallet:', err)
      // Don't show error toast on initial load, only on user actions
    }
  }

  useEffect(()=>{ 
    refresh()
    // Listen for wallet updates from other pages/components
    const handleUpdate = () => {
      refresh()
    }
    window.addEventListener('walletUpdated', handleUpdate)
    return () => window.removeEventListener('walletUpdated', handleUpdate)
  }, [])

  async function act(action: 'deposit'|'withdraw') {
    const numAmount = parseFloat(amount) || 0
    if (numAmount <= 0) {
      showToast('Please enter a valid amount', 'error')
      return
    }
    setBusy(true)
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      const r = await fetch(`${baseUrl}/api/wallet`, { 
        method: 'POST', 
        headers: { 'Content-Type':'application/json' }, 
        body: JSON.stringify({ action, amount: numAmount }) 
      })
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        showToast(errorData?.error || 'Transaction failed', 'error')
        return
      }
      const j = await r.json()
      // Update balance from response (maintains old balance + new amount)
      setBalance(j.balance || 0)
      // Clear input after successful transaction
      setAmount('')
      showToast(
        action==='deposit' 
          ? `Deposited $${numAmount.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}` 
          : `Withdrew $${numAmount.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}`, 
        'success'
      )
      // Trigger global wallet update event
      try { window.dispatchEvent(new CustomEvent('walletUpdated')) } catch {}
      // Refresh to ensure consistency
      await refresh()
    } catch (err: any) {
      showToast(err?.message || 'Transaction failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Quick add: ADD to current amount, don't replace
  function quickAdd(value: number) {
    const current = parseFloat(amount) || 0
    const newAmount = current + value
    setAmount(newAmount.toString())
  }

  return (
    <main className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h1 className="text-2xl font-bold text-white mb-4">Demo Wallet</h1>
        <div className="text-slate-300 mb-6">
          Balance: <span className="text-white font-semibold text-xl">${balance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span> 
          <span className="text-slate-400 text-sm ml-2">(cap $1,000,000)</span>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <input 
            type="number" 
            value={amount} 
            onChange={e=>setAmount(e.target.value)} 
            onKeyDown={e => {
              if (e.key === 'Enter' && parseFloat(amount) > 0) {
                act('deposit')
              }
            }}
            placeholder="Enter amount" 
            className="px-4 py-2 rounded bg-slate-700 text-white outline-none border border-slate-600 focus:border-blue-500 flex-1 max-w-xs" 
            min="0"
            step="0.01"
          />
          <button 
            disabled={busy || !amount || parseFloat(amount) <= 0} 
            onClick={()=>act('deposit')} 
            className="px-6 py-2 rounded bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition"
          >
            Deposit
          </button>
          <button 
            disabled={busy || !amount || parseFloat(amount) <= 0} 
            onClick={()=>act('withdraw')} 
            className="px-6 py-2 rounded bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition"
          >
            Withdraw
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Quick add:</span>
          {[100, 1000, 10000].map(v=> (
            <button 
              key={v} 
              onClick={()=>quickAdd(v)} 
              disabled={busy} 
              className="px-3 py-1 rounded bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50 transition"
            >
              ${v.toLocaleString()}
            </button>
          ))}
          <button
            onClick={() => setAmount('')}
            className="px-3 py-1 rounded bg-slate-700 text-white hover:bg-slate-600 text-xs ml-2 transition"
          >
            Clear
          </button>
        </div>
        {amount && parseFloat(amount) > 0 && (
          <div className="mt-4 text-sm text-slate-400">
            <span>
              Preview: After deposit of ${parseFloat(amount).toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}, 
              balance will be <span className="text-white font-semibold ml-1">
                ${(balance + parseFloat(amount)).toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}
              </span>
            </span>
          </div>
        )}
      </div>
    </main>
  )
}


