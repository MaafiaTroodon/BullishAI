'use client'

import { useEffect, useState } from 'react'
import { ScreenTable } from '@/components/ScreenTable'
import { ReboundRow } from '@/lib/screens/explanations'

export default function ReboundPage() {
  const [data, setData] = useState<ReboundRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const res = await fetch('/api/screens/undervalued-rebound')
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
    { key: 'ytd_return', label: 'YTD Return %', sortable: true, format: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` },
    { key: 'ret_10d', label: '10D Return %', sortable: true, format: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` },
    { key: 'recovery_score', label: 'Recovery Score', sortable: true, format: (v: number) => v.toFixed(2) },
  ]

  return (
    <ScreenTable
      title="Undervalued Rebound"
      columns={columns}
      data={data}
      screenType="rebound"
      apiEndpoint="/api/screens/undervalued-rebound"
      onRefresh={fetchData}
    />
  )
}

