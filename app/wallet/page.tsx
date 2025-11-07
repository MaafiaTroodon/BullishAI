'use client'

import { useEffect, useState } from 'react'
import { showToast } from '@/components/Toast'

export default function WalletPage() {
  const [balance, setBalance] = useState<number>(0)
  const [amount, setAmount] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [previewAction, setPreviewAction] = useState<'deposit'|'withdraw'>('deposit')

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
    
    // Client-side validation
    if (numAmount <= 0) {
      showToast('Please enter a valid amount', 'error')
      return
    }
    
    // Validate decimal places (max 2)
    const roundedAmount = Math.round(numAmount * 100) / 100
    if (Math.abs(numAmount - roundedAmount) > 0.001) {
      showToast('Amount cannot have more than 2 decimal places', 'error')
      return
    }
    
    // Validate cap for deposits
    if (action === 'deposit' && (balance + roundedAmount) > 1_000_000) {
      showToast(`Deposit would exceed wallet cap of $1,000,000. Current balance: $${balance.toFixed(2)}`, 'error')
      return
    }
    
    // Validate sufficient balance for withdrawals
    if (action === 'withdraw' && roundedAmount > balance) {
      showToast(`Insufficient balance. Current balance: $${balance.toFixed(2)}`, 'error')
      return
    }
    
    setBusy(true)
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      // Generate idempotency key to prevent duplicate transactions
      const idempotencyKey = `${action}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      const r = await fetch(`${baseUrl}/api/wallet`, { 
        method: 'POST', 
        headers: { 'Content-Type':'application/json' }, 
        body: JSON.stringify({ 
          action, 
          amount: roundedAmount,
          idempotencyKey 
        }) 
      })
      
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        const errorMessage = errorData?.message || errorData?.error || 'Transaction failed'
        showToast(errorMessage, 'error')
        // Keep amount in input on error
        return
      }
      
      const j = await r.json()
      
      // Server is source of truth - update balance from response
      const newBalance = j.balance || 0
      setBalance(newBalance)
      
      // Clear input after successful transaction
      setAmount('')
      
      // Show success toast with new balance
      showToast(
        action==='deposit' 
          ? `Deposited $${roundedAmount.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}. New balance: $${newBalance.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}` 
          : `Withdrew $${roundedAmount.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}. New balance: $${newBalance.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}`, 
        'success'
      )
      
      // Trigger global wallet update event for navbar and history page
      try { window.dispatchEvent(new CustomEvent('walletUpdated')) } catch {}
    } catch (err: any) {
      showToast(err?.message || 'Transaction failed', 'error')
      // Keep amount in input on error
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
            onClick={()=>{ setPreviewAction('deposit'); act('deposit') }} 
            className="px-6 py-2 rounded bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition"
          >
            Deposit
          </button>
          <button 
            disabled={busy || !amount || parseFloat(amount) <= 0} 
            onClick={()=>{ setPreviewAction('withdraw'); act('withdraw') }} 
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
              Preview: After {previewAction === 'deposit' ? 'deposit' : 'withdrawal'} of ${parseFloat(amount).toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}, 
              balance will be <span className="text-white font-semibold ml-1">
                ${previewAction === 'deposit' 
                  ? Math.max(0, Math.min(1_000_000, balance + parseFloat(amount))).toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})
                  : Math.max(0, balance - parseFloat(amount)).toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})
                }
              </span>
            </span>
          </div>
        )}
      </div>
    </main>
  )
}


