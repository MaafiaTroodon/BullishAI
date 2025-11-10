'use client'

import { useEffect, useState } from 'react'
import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'
import { Zap, ArrowLeft, TrendingUp } from 'lucide-react'

export default function QuickInsightsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/ai/quick-insights')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
        setData({
          snapshot: 'Market analysis unavailable. Please check back later.',
          tickers: [],
        })
      })
  }, [])

  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '—'
    const sign = value >= 0 ? '+' : ''
    return `${sign}${(value * 100).toFixed(2)}%`
  }

  const formatPrice = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '—'
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="min-h-screen bg-slate-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal variant="fade">
          <Link href="/ai" className="text-blue-400 hover:text-blue-300 mb-6 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to AI Menu
          </Link>
        </Reveal>

        <Reveal variant="rise">
          <div className="flex items-center gap-3 mb-8">
            <Zap className="w-8 h-8 text-blue-400" />
            <h1 className="text-4xl font-bold text-white">Quick Insights</h1>
          </div>
        </Reveal>

        {loading ? (
          <Reveal variant="fade">
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 shadow-lg">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                <div className="h-4 bg-slate-700 rounded w-full"></div>
                <div className="h-4 bg-slate-700 rounded w-5/6"></div>
              </div>
            </div>
          </Reveal>
        ) : (
          <>
            <Reveal variant="fade" delay={0.1}>
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-semibold rounded-full">
                    {data?.provider || 'groq-llama'}
                  </span>
                  <span className="text-slate-500 text-sm">
                    {data?.latency_ms ? `${data.latency_ms}ms` : ''}
                  </span>
                </div>
                <div className="relative">
                  <p className={`text-slate-300 leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>
                    {data?.snapshot || 'No insights available'}
                  </p>
                  {data?.snapshot && data.snapshot.length > 150 && (
                    <button
                      onClick={() => setExpanded(!expanded)}
                      className="mt-2 text-blue-400 text-sm hover:text-blue-300"
                    >
                      {expanded ? 'Show less' : 'more'}
                    </button>
                  )}
                </div>
              </div>
            </Reveal>

            {data?.tickers && data.tickers.length > 0 ? (
              <Reveal variant="fade" delay={0.2}>
                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-6 shadow-lg">
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Top Tickers to Watch
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {data.tickers.map((ticker: any) => {
                      const changePct = ticker.change_pct
                      const isPositive = changePct !== null && changePct !== undefined && changePct > 0
                      const isNegative = changePct !== null && changePct !== undefined && changePct < 0
                      const isNull = changePct === null || changePct === undefined
                      
                      return (
                        <Link key={`ticker-${ticker.symbol}-${ticker.rank}`} href={`/stocks/${ticker.symbol}`}>
                          <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 rounded-xl p-5 border border-slate-600 hover:border-blue-500/50 transition-all cursor-pointer hover:scale-[1.02] shadow-lg">
                            <div className="flex items-center justify-between mb-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                {ticker.rank}
                              </div>
                              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                isPositive ? 'bg-green-500/20 text-green-400' :
                                isNegative ? 'bg-red-500/20 text-red-400' :
                                'bg-slate-500/20 text-slate-400'
                              }`}>
                                {isPositive ? '↑' : isNegative ? '↓' : ''} {formatPercent(changePct)}
                              </div>
                            </div>
                            <div className="font-bold text-white text-xl mb-1">{ticker.symbol}</div>
                            <div className="text-sm text-slate-400 mb-3">{ticker.name || ticker.symbol}</div>
                            {ticker.tags && ticker.tags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                {ticker.tags.slice(0, 2).map((tag: string, idx: number) => (
                                  <div key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                                    {tag}
                                  </div>
                                ))}
                                {ticker.tags.length > 2 && (
                                  <div className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded">
                                    +{ticker.tags.length - 2} more
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </Reveal>
            ) : (
              <Reveal variant="fade" delay={0.2}>
                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-6 shadow-lg text-center">
                  <p className="text-slate-400">No highlights today</p>
                </div>
              </Reveal>
            )}

            <Reveal variant="fade" delay={0.3}>
              <div className="mt-6 bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
                <p className="text-yellow-400 text-sm">
                  ⚠️ Not financial advice. Market insights are for informational purposes only. Always do your own research.
                </p>
              </div>
            </Reveal>
          </>
        )}
      </div>
    </div>
  )
}

