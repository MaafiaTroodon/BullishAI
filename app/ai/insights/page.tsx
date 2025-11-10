'use client'

import { AIInsightsToolbar } from '@/components/AIInsightsToolbar'
import { useSearchParams } from 'next/navigation'

export default function AIInsightsPage() {
  const searchParams = useSearchParams()
  const symbol = searchParams.get('symbol')?.toUpperCase()

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="h-screen flex flex-col">
        <div className="p-4 border-b border-slate-700 bg-slate-800">
          <h1 className="text-2xl font-bold text-white">AI Insights Dashboard</h1>
          {symbol && (
            <p className="text-sm text-slate-400 mt-1">Analyzing: {symbol}</p>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <AIInsightsToolbar symbol={symbol} />
        </div>
      </div>
    </div>
  )
}

