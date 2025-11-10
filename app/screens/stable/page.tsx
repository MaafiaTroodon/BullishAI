'use client'

import { useEffect, useState } from 'react'
import { ScreenTable } from '@/components/ScreenTable'
import { StableRow } from '@/lib/screens/explanations'

export default function StablePage() {
  const [data, setData] = useState<StableRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/screens/stable-growth')
      .then(r => r.json())
      .then(d => {
        setData(d.items || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    )
  }

  const columns = [
    { key: 'ticker', label: 'Ticker', sortable: true },
    { key: 'price', label: 'Price', sortable: true, format: (v: number) => `$${v.toFixed(2)}` },
    { key: 'beta', label: 'Beta', sortable: true, format: (v: number) => v.toFixed(2) },
    { key: 'eps_cagr_5y', label: 'EPS CAGR 5Y %', sortable: true, format: (v: number) => `${v.toFixed(1)}%` },
    { key: 'stability_score', label: 'Stability Score', sortable: true, format: (v: number) => v.toFixed(2) },
  ]

  return (
    <ScreenTable
      title="Stable Growth Picks"
      columns={columns}
      data={data}
      screenType="stable"
      apiEndpoint="/api/screens/stable-growth"
    />
  )
}

