'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

interface ChartData {
  timestamp: number
  close: number
  high: number
  low: number
  open: number
}

interface StockChartProps {
  data: ChartData[]
  symbol: string
}

export function StockChart({ data, symbol }: StockChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 h-[400px] flex items-center justify-center">
        <p className="text-slate-400">No chart data available</p>
      </div>
    )
  }

  // Format data for the chart
  const chartData = data.map(item => ({
    date: new Date(item.timestamp).toLocaleDateString(),
    value: item.close,
    time: new Date(item.timestamp).toLocaleTimeString(),
  }))

  const isPositive = data[data.length - 1]?.close >= data[0]?.open
  
  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <h3 className="text-xl font-semibold text-white mb-4">{symbol} Price Chart</h3>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
          <XAxis 
            dataKey="date" 
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8' }}
          />
          <YAxis 
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8' }}
            tickFormatter={(value) => `$${value.toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569', 
              borderRadius: '8px',
              color: '#e2e8f0'
            }}
            formatter={(value: any) => [`$${value.toFixed(2)}`, 'Price']}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={isPositive ? "#22c55e" : "#ef4444"} 
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorGradient)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

