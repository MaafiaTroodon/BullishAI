'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

interface ChartData {
  t: number  // timestamp
  c: number  // close
  h?: number  // high
  l?: number  // low
  o?: number  // open
}

interface StockChartProps {
  data: ChartData[]
  symbol: string
  range?: string
  source?: string  // Data provider
}

export function StockChart({ data, symbol, range = '1d', source }: StockChartProps) {
  const chartData = data && data.length > 0 
    ? data
        .slice()
        .sort((a, b) => a.t - b.t) // Ensure chronological order
        .map(item => {
          const timestamp = new Date(item.t)
          let displayLabel = ''
          
          // Format based on range
          if (range === '1d') {
            displayLabel = timestamp.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            })
          } else if (range === '5d') {
            displayLabel = timestamp.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            })
          } else if (range === '1m' || range === '6m') {
            displayLabel = timestamp.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            })
          } else {
            displayLabel = timestamp.toLocaleDateString('en-US', { 
              month: 'short', 
              year: '2-digit' 
            })
          }
          
          return {
            timestamp: item.t,
            value: item.c,
            displayLabel,
          }
        })
    : []

  const isPositive = chartData.length > 0 
    ? chartData[chartData.length - 1]?.value >= (chartData[0]?.value || 0)
    : true
  
  // Calculate percent change
  const percentChange = chartData.length > 0 && chartData[0].value > 0
    ? ((chartData[chartData.length - 1].value - chartData[0].value) / chartData[0].value) * 100
    : 0
  
  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-semibold text-white">{symbol} Price Chart</h3>
          {source && (
            <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
              Source: {source}
            </span>
          )}
        </div>
        {chartData.length > 0 && (
          <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            <span>{isPositive ? '↗' : '↘'}</span>
            <span>{(percentChange >= 0 ? '+' : '')}{percentChange.toFixed(2)}%</span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={500}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
          <defs>
            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
          <XAxis 
            dataKey="displayLabel" 
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            angle={range === '1d' ? -45 : 0}
            textAnchor={range === '1d' ? 'end' : 'middle'}
            height={50}
          />
          <YAxis 
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8' }}
            tickFormatter={(value) => `$${value.toFixed(2)}`}
            domain={['dataMin', 'dataMax']}
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569', 
              borderRadius: '8px',
              color: '#e2e8f0'
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload.length > 0) {
                const timestamp = payload[0].payload.timestamp
                return new Date(timestamp).toLocaleString()
              }
              return label
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

