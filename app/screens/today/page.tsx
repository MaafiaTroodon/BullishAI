'use client'

import { useEffect, useState } from 'react'
import { ScreenTable } from '@/components/ScreenTable'
import { TodayRow } from '@/lib/screens/explanations'

export default function TodayPage() {
  const [data, setData] = useState<TodayRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const res = await fetch('/api/screens/strongest-today')
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
    { key: 'intraday_change', label: 'Intraday Change %', sortable: true, format: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` },
    { key: 'vol_vs_avg_x', label: 'Vol vs Avg (x)', sortable: true, format: (v: number) => `${v.toFixed(1)}×` },
    { key: 'today_score', label: 'Today Score', sortable: true, format: (v: number) => v.toFixed(2) },
  ]

  return (
    <ScreenTable
      title="Strongest Today"
      columns={columns}
      data={data}
      screenType="today"
      apiEndpoint="/api/screens/strongest-today"
      onRefresh={fetchData}
    />
  )
}

