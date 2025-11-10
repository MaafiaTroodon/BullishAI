'use client'

import { useEffect, useState } from 'react'
import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'
import { Zap, ArrowLeft, TrendingUp } from 'lucide-react'

export default function QuickInsightsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
      })
  }, [])

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
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                <div className="h-4 bg-slate-700 rounded w-full"></div>
                <div className="h-4 bg-slate-700 rounded w-5/6"></div>
              </div>
            </div>
          </Reveal>
        ) : data?.error ? (
          <Reveal variant="fade">
            <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
              <p className="text-red-400">Error: {data.error}</p>
            </div>
          </Reveal>
        ) : (
          <>
            <Reveal variant="fade" delay={0.1}>
              <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-semibold rounded-full">
                    {data?.model || 'groq-llama'}
                  </span>
                  <span className="text-slate-500 text-sm">
                    {data?.latency ? `${data.latency}ms` : ''}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                  {data?.insight || 'No insights available'}
                </p>
              </div>
            </Reveal>

            {data?.topTickers && data.topTickers.length > 0 && (
              <Reveal variant="fade" delay={0.2}>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Top Tickers to Watch
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {data.topTickers.map((ticker: any, idx: number) => (
                      <Link key={idx} href={`/stocks/${ticker.symbol}`}>
                        <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600 hover:border-blue-500/50 transition cursor-pointer">
                          <div className="font-bold text-white text-lg mb-1">{ticker.symbol}</div>
                          <div className="text-sm text-slate-400 mb-2">{ticker.name || ticker.symbol}</div>
                          <div className={`font-semibold text-lg ${ticker.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {ticker.change >= 0 ? '+' : ''}{ticker.change?.toFixed(2)}%
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{ticker.reason || 'Market index'}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
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

