'use client'

import { useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import useSWR from 'swr'

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' })
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    return null as any
  }
  return res.json()
}

type SparklineProps = {
  symbol: string
  width?: number
  height?: number
}

export function HoldingSparkline({ symbol, width = 120, height = 40 }: SparklineProps) {
  const { data } = useSWR(
    `/api/holdings/${symbol}/timeseries?range=1M&gran=1d`,
    fetcher,
    { refreshInterval: 30000 }
  )

  const points = useMemo(() => {
    if (!data?.series || !Array.isArray(data.series)) {
      return []
    }
    // Take last 30 days for sparkline
    return data.series.slice(-30).map((p: any) => ({
      t: p.t,
      value: p.value || 0
    }))
  }, [data])

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <div className="text-xs text-slate-500">No data</div>
      </div>
    )
  }

  const min = Math.min(...points.map(p => p.value))
  const max = Math.max(...points.map(p => p.value))
  const range = max - min || 1
  const isPositive = points[points.length - 1]?.value >= points[0]?.value

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={isPositive ? '#10b981' : '#ef4444'}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

