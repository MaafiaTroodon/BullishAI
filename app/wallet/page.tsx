'use client'

import { useEffect, useState } from 'react'

export default function WalletPage() {
  const [balance, setBalance] = useState<number>(0)
  const [amount, setAmount] = useState<number>(0)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const r = await fetch('/api/wallet', { cache: 'no-store' })
    const j = await r.json()
    setBalance(j.balance || 0)
  }

  useEffect(()=>{ refresh() }, [])

  async function act(action: 'deposit'|'withdraw') {
    if (amount <= 0) return
    setBusy(true)
    try {
      const r = await fetch('/api/wallet', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ action, amount }) })
      const j = await r.json()
      if (!r.ok) {
        alert(j?.error || 'Wallet error')
      } else {
        setBalance(j.balance || 0)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h1 className="text-2xl font-bold text-white mb-4">Demo Wallet</h1>
        <div className="text-slate-300 mb-6">Balance: <span className="text-white font-semibold">${balance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span> (cap $1,000,000)</div>
        <div className="flex items-center gap-3">
          <input type="number" value={amount} onChange={e=>setAmount(Number(e.target.value))} placeholder="Amount" className="px-3 py-2 rounded bg-slate-700 text-white outline-none" />
          <button disabled={busy || amount<=0} onClick={()=>act('deposit')} className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50">Deposit</button>
          <button disabled={busy || amount<=0} onClick={()=>act('withdraw')} className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50">Withdraw</button>
        </div>
      </div>
    </main>
  )
}


