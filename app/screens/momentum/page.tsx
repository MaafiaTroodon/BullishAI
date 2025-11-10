'use client'

import { useEffect, useState } from 'react'
import { ScreenTable } from '@/components/ScreenTable'
import { MomentumRow } from '@/lib/screens/explanations'

export default function MomentumPage() {
  const [data, setData] = useState<MomentumRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const res = await fetch('/api/screens/strongest-momentum')
      const d = await res.json()
      setData(d.items || [])
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
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
    { key: 'ret_5d', label: '5D Return %', sortable: true, format: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` },
    { key: 'rsi_14', label: 'RSI (14)', sortable: true, format: (v: number) => v.toFixed(1) },
    { key: 'vol_surge_x', label: 'Vol Surge (x)', sortable: true, format: (v: number) => `${v.toFixed(1)}×` },
    { key: 'score', label: 'Score', sortable: true, format: (v: number) => v.toFixed(2) },
  ]

  return (
    <ScreenTable
      title="Strongest Momentum"
      columns={columns}
      data={data}
      screenType="momentum"
      apiEndpoint="/api/screens/strongest-momentum"
      onRefresh={fetchData}
    />
  )
}

