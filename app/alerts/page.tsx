'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { GlobalNavbar } from '@/components/GlobalNavbar'

const fetcher = (url: string) => fetch(url).then(r => r.json())

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
  const [open, setOpen] = useState(false)
  const [symbol, setSymbol] = useState('AAPL')
  const [type, setType] = useState<Alert['type']>('price_above')
  const [value, setValue] = useState<number>(0)
  const [notes, setNotes] = useState('')

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
    await fetch(`/api/alerts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })
    mutate()
  }

  async function removeAlert(id: string) {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
    mutate()
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <GlobalNavbar />
      <main className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Price Alerts</h1>
            <p className="text-slate-400 text-sm">Get notified when stocks hit your target prices</p>
          </div>
          <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">+ Create Alert</button>
        </div>

        {isLoading || items.length === 0 ? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <div className="text-slate-400 mb-3">No alerts yet</div>
            <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">Create Alert</button>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="divide-y divide-slate-700">
              {items.map(a => (
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
                  <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full bg-slate-700 text-white rounded-md px-3 py-2 outline-none" placeholder="e.g., 250" />
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

'use client'

import { useState } from 'react'
import { Bell, Plus, Trash2, AlertCircle } from 'lucide-react'

export default function AlertsPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Price Alerts</h1>
            <p className="text-slate-400">Get notified when stocks hit your target prices</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus className="h-5 w-5" />
            Create Alert
          </button>
        </div>

        {/* Alerts List */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Bell className="h-16 w-16 text-slate-500 mb-4" />
            <p className="text-slate-400 text-lg mb-2">No alerts yet</p>
            <p className="text-slate-500 text-sm mb-6">Create your first price alert</p>
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Create Alert
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

