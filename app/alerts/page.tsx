'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Reveal } from '@/components/anim/Reveal'
import { StaggerGrid } from '@/components/anim/StaggerGrid'

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

type Alert = {
  id: string
  symbol: string
  type: 'price_above' | 'price_below' | 'percent_up' | 'percent_down' | 'volume_above'
  value: number
  active: boolean
  createdAt: number
  notes?: string
}

export default function AlertsPage() {
  const { data, mutate, isLoading } = useSWR('/api/alerts', fetcher)
  const items: Alert[] = data?.items || []
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all')
  const filteredItems = items.filter(a => filter === 'all' ? true : filter === 'active' ? a.active : !a.active)
  const [open, setOpen] = useState(false)
  const [symbol, setSymbol] = useState('AAPL')
  const [type, setType] = useState<Alert['type']>('price_above')
  const [value, setValue] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)

  // Fetch current price for convenience
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!symbol) return
      setPriceLoading(true)
      try {
        const r = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`)
        const j = await r.json()
        const p = j?.data?.price ?? j?.price
        if (!cancelled) setCurrentPrice(typeof p === 'number' ? p : null)
      } catch {
        if (!cancelled) setCurrentPrice(null)
      } finally {
        if (!cancelled) setPriceLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [symbol])

  async function createAlert() {
    if (!symbol || !value) return
    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: symbol.toUpperCase(), type, value: Number(value), notes }),
    })
    setOpen(false)
    setValue(0)
    setNotes('')
    mutate()
  }

  async function toggleActive(id: string, active: boolean) {
    // optimistic update
    mutate((prev: any) => ({ items: (prev?.items || []).map((i: Alert) => i.id === id ? { ...i, active } : i) }), false)
    fetch(`/api/alerts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })
      .then(() => mutate())
      .catch(() => mutate())
  }

  async function removeAlert(id: string) {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
    mutate()
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <main className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Price Alerts</h1>
            <p className="text-slate-400 text-sm">Get notified when stocks hit your target prices</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-1">
              {(['all','active','paused'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-md text-sm font-semibold ${filter===f ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'}`}>{f[0].toUpperCase()+f.slice(1)}</button>
              ))}
            </div>
            <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">+ Create Alert</button>
          </div>
        </div>

        {isLoading || items.length === 0 ? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <div className="text-slate-400 mb-3">No alerts yet</div>
            <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">Create Alert</button>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="divide-y divide-slate-700">
              {filteredItems.map(a => (
                <div key={a.id} className="flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-4">
                    <div className="text-white font-semibold">{a.symbol}</div>
                    <div className="text-slate-300 text-sm">
                      {a.type.replace('_', ' ')} <span className="text-white font-semibold">{a.value}</span>
                    </div>
                    {a.notes && <div className="text-slate-400 text-xs">{a.notes}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleActive(a.id, !a.active)} className={`px-2 py-1 rounded-md text-xs font-semibold ${a.active ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`}>{a.active ? 'Active' : 'Paused'}</button>
                    <button onClick={() => removeAlert(a.id)} className="px-2 py-1 rounded-md text-xs font-semibold bg-red-600 text-white">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {open && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="text-white font-bold text-lg mb-4">Create Alert</div>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Symbol</label>
                  <input value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full bg-slate-700 text-white rounded-md px-3 py-2 outline-none" placeholder="AAPL" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Alert Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full bg-slate-700 text-white rounded-md px-3 py-2 outline-none">
                    <option value="price_above">Price Above</option>
                    <option value="price_below">Price Below</option>
                    <option value="percent_up">Percent Up</option>
                    <option value="percent_down">Percent Down</option>
                    <option value="volume_above">Volume Above</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Value</label>
                  <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full bg-slate-700 text-white rounded-md px-3 py-2 outline-none" placeholder={currentPrice ? currentPrice.toFixed(2) : 'e.g., 250'} />
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                    <span>Current:</span>
                    <span className="text-white font-semibold">{priceLoading ? 'Loading…' : currentPrice ? `$${currentPrice.toFixed(2)}` : 'N/A'}</span>
                    {currentPrice && (
                      <>
                        <button onClick={() => setValue(Number(currentPrice.toFixed(2)))} className="px-2 py-1 bg-slate-700 text-slate-200 rounded">Use</button>
                        <button onClick={() => setValue(Number((currentPrice * 1.01).toFixed(2)))} className="px-2 py-1 bg-slate-700 text-slate-200 rounded">+1%</button>
                        <button onClick={() => setValue(Number((currentPrice * 0.99).toFixed(2)))} className="px-2 py-1 bg-slate-700 text-slate-200 rounded">-1%</button>
                        <button onClick={() => setValue(Number((currentPrice * 1.05).toFixed(2)))} className="px-2 py-1 bg-slate-700 text-slate-200 rounded">+5%</button>
                        <button onClick={() => setValue(Number((currentPrice * 0.95).toFixed(2)))} className="px-2 py-1 bg-slate-700 text-slate-200 rounded">-5%</button>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Notes (optional)</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-slate-700 text-white rounded-md px-3 py-2 outline-none" placeholder="Optional note" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 font-semibold">Cancel</button>
                <button onClick={createAlert} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">Create</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
