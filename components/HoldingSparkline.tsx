'use client'

import { useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'
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

  const { points, trend, deltaPct, yDomain } = useMemo(() => {
    if (!data?.series || !Array.isArray(data.series)) {
      return { points: [], trend: 'up' as const, deltaPct: 0, yDomain: [0, 100] }
    }
    
    // Take last 30 days for sparkline
    const series = data.series.slice(-30).map((p: any) => ({
      t: p.t,
      value: p.value || 0
    })).filter((p: any) => p.value > 0)
    
    if (series.length === 0) {
      return { points: [], trend: 'up' as const, deltaPct: 0, yDomain: [0, 100] }
    }
    
    // Calculate delta percentage from API meta
    const deltaPctSymbol = data?.meta?.deltaPctSymbol ?? 0
    const trend: 'up' | 'down' = deltaPctSymbol >= 0 ? 'up' : 'down'
    
    // Calculate y-domain from min/max with 8% padding (no zero-anchoring)
    const values = series.map(p => p.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || max || 1
    const padding = range * 0.08
    const domainMin = Math.max(0, min - padding)
    const domainMax = max + padding
    
    return {
      points: series,
      trend,
      deltaPct: deltaPctSymbol * 100,
      yDomain: [domainMin, domainMax]
    }
  }, [data])

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <div className="text-xs text-slate-500">No data</div>
      </div>
    )
  }

  const strokeColor = trend === 'up' ? '#10b981' : '#ef4444'
  const arrow = trend === 'up' ? '▲' : '▼'

  return (
    <div className="relative" style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 2, right: 16, left: 2, bottom: 2 }}>
          <YAxis hide domain={yDomain} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      {/* Arrow indicator at last point */}
      <div 
        className="absolute text-xs font-bold pointer-events-none"
        style={{
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
          color: strokeColor
        }}
      >
        {arrow}
      </div>
    </div>
  )
}
