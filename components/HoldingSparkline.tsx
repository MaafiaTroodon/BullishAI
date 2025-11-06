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
    `/api/holdings/${symbol}/timeseries?range=1d&gran=5m`,
    fetcher,
    { refreshInterval: 15000 } // Update every 15 seconds for real-time during market hours
  )

  const points = useMemo(() => {
    if (!data?.series || !Array.isArray(data.series)) {
      return []
    }
    // Use all available points for 1 day (should be 5-minute intervals)
    // Use price per share, not total value, to show actual stock movement
    return data.series.map((p: any) => ({
      t: p.t,
      price: p.price || 0
    })).filter((p: any) => p.price > 0)
  }, [data])

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <div className="text-xs text-slate-500">No data</div>
      </div>
    )
  }

  // Calculate trend based on price movement (not value)
  const firstPrice = points[0]?.price || 0
  const lastPrice = points[points.length - 1]?.price || 0
  const isPositive = lastPrice >= firstPrice

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="price"
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

