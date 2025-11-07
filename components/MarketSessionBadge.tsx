'use client'

import { useEffect, useState } from 'react'
import { getMarketSession, MarketSessionInfo } from '@/lib/marketSession'

export function MarketSessionBadge() {
  const [sessionInfo, setSessionInfo] = useState<MarketSessionInfo>(getMarketSession())

  useEffect(() => {
    // Update every minute
    const interval = setInterval(() => {
      setSessionInfo(getMarketSession())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const colorClasses = {
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`px-2 py-1 rounded text-xs font-semibold border ${colorClasses[sessionInfo.color as keyof typeof colorClasses]}`}
        title={sessionInfo.description}
        aria-label={`Market session: ${sessionInfo.label}`}
      >
        ● {sessionInfo.label}
      </div>
      {sessionInfo.description && sessionInfo.session === 'POST' && (
        <span className="text-xs text-slate-400">{sessionInfo.description}</span>
      )}
    </div>
  )
}

