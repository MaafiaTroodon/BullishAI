'use client'

import { useEffect, useState } from 'react'
import { getMarketSession, getSessionCountdown, MarketSessionInfo } from '@/lib/marketSession'
import { Sunrise, Sun, Sunset, Moon, X } from 'lucide-react'

export function MarketSessionBadge() {
  const [sessionInfo, setSessionInfo] = useState<MarketSessionInfo>(getMarketSession())
  const [countdown, setCountdown] = useState<string | null>(null)

  useEffect(() => {
    // Update every minute
    const interval = setInterval(() => {
      const info = getMarketSession()
      setSessionInfo(info)
      setCountdown(getSessionCountdown(info.endsAt))
    }, 60000)

    // Initial countdown
    setCountdown(getSessionCountdown(sessionInfo.endsAt))

    return () => clearInterval(interval)
  }, [])

  const iconMap = {
    sunrise: Sunrise,
    sun: Sun,
    sunset: Sunset,
    moon: Moon,
    closed: X
  }

  const Icon = iconMap[sessionInfo.icon] || X

  const colorClasses = {
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`px-2 py-1 rounded text-xs font-semibold border flex items-center gap-1 ${colorClasses[sessionInfo.color as keyof typeof colorClasses]}`}
        title={sessionInfo.description + (countdown ? ` (ends in ${countdown})` : '')}
        aria-label={`Market session: ${sessionInfo.label}`}
      >
        <Icon className="h-3 w-3" />
        <span>{sessionInfo.label}</span>
        {countdown && sessionInfo.session !== 'CLOSED' && (
          <span className="text-[10px] opacity-75">({countdown})</span>
        )}
      </div>
      {sessionInfo.description && sessionInfo.session === 'POST' && (
        <span className="text-xs text-slate-400">{sessionInfo.description}</span>
      )}
    </div>
  )
}

