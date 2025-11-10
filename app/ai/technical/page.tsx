'use client'

import { useState, useEffect } from 'react'
import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'
import { BarChart3, ArrowLeft, Search } from 'lucide-react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function TechnicalPage() {
  const searchParams = useSearchParams()
  const [symbol, setSymbol] = useState(searchParams.get('symbol')?.toUpperCase() || 'AAPL')
  const [searchQuery, setSearchQuery] = useState('')

  const { data, error, isLoading } = useSWR(
    symbol ? `/api/ai/technical?symbol=${symbol}` : null,
    fetcher,
    { refreshInterval: 60000 }
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setSymbol(searchQuery.trim().toUpperCase())
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal variant="fade">
          <Link href="/ai" className="text-blue-400 hover:text-blue-300 mb-6 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to AI Menu
          </Link>
        </Reveal>

        <Reveal variant="rise">
          <div className="flex items-center gap-3 mb-8">
            <BarChart3 className="w-8 h-8 text-green-400" />
            <h1 className="text-4xl font-bold text-white">Technical Analysis</h1>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={0.1}>
          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter stock symbol (e.g., AAPL, TSLA)"
                  className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Analyze
              </button>
            </div>
          </form>
        </Reveal>

        {isLoading ? (
          <Reveal variant="fade">
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                <div className="h-4 bg-slate-700 rounded w-full"></div>
                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              </div>
            </div>
          </Reveal>
        ) : error || data?.error ? (
          <Reveal variant="fade">
            <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
              <p className="text-red-400">Error: {error?.message || data?.error || 'Failed to load technical analysis'}</p>
            </div>
          </Reveal>
        ) : data?.analysis ? (
          <>
            <Reveal variant="fade" delay={0.2}>
              <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{data.symbol}</h2>
                    <p className="text-slate-400">Technical Analysis</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-green-600/20 text-green-400 text-xs font-semibold rounded-full">
                      {data.model || 'groq-llama'}
                    </span>
                    <span className="text-slate-500 text-sm">
                      {data.latency ? `${data.latency}ms` : ''}
                    </span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <div className="text-sm text-slate-400 mb-2">Trend</div>
                    <div className={`text-2xl font-bold ${
                      data.analysis.trend === 'bullish' ? 'text-green-400' :
                      data.analysis.trend === 'bearish' ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      {data.analysis.trend?.toUpperCase() || 'NEUTRAL'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-2">Momentum Score</div>
                    <div className="text-2xl font-bold text-white">
                      {data.analysis.momentumScore || 50}/100
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <div className="text-sm text-slate-400 mb-2">Support Level</div>
                    <div className="text-xl font-semibold text-green-400">
                      ${typeof data.analysis.supportLevel === 'number' ? data.analysis.supportLevel.toFixed(2) : (parseFloat(data.analysis.supportLevel) || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-2">Resistance Level</div>
                    <div className="text-xl font-semibold text-red-400">
                      ${typeof data.analysis.resistanceLevel === 'number' ? data.analysis.resistanceLevel.toFixed(2) : (parseFloat(data.analysis.resistanceLevel) || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {data.analysis.patterns && data.analysis.patterns.length > 0 && (
                  <div className="mb-6">
                    <div className="text-sm text-slate-400 mb-3">Patterns Detected</div>
                    <div className="flex flex-wrap gap-2">
                      {data.analysis.patterns.map((pattern: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-blue-600/20 text-blue-400 text-sm rounded">
                          {pattern}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {data.analysis.riskNote && (
                  <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                    <p className="text-yellow-400 text-sm">{data.analysis.riskNote}</p>
                  </div>
                )}
              </div>
            </Reveal>

            <Reveal variant="fade" delay={0.3}>
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
                <p className="text-yellow-400 text-sm">
                  ⚠️ Not financial advice. Technical analysis is for informational purposes only.
                </p>
              </div>
            </Reveal>
          </>
        ) : (
          <Reveal variant="fade">
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 text-center">
              <p className="text-slate-400">Enter a stock symbol to analyze</p>
            </div>
          </Reveal>
        )}
      </div>
    </div>
  )
}

