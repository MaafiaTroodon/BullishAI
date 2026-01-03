'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState, useEffect } from 'react'
import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'
import { BarChart3, ArrowLeft, Search } from 'lucide-react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import { AIGate } from '@/components/AIGate'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function TechnicalContent() {
  const searchParams = useSearchParams()
  const [symbol, setSymbol] = useState(searchParams.get('symbol')?.toUpperCase() || 'AAPL')
  const [searchQuery, setSearchQuery] = useState('')
  const [recentSymbols, setRecentSymbols] = useState<string[]>([])

  const { data, error, isLoading } = useSWR(
    symbol ? `/api/ai/technical?symbol=${symbol}` : null,
    fetcher,
    { refreshInterval: 60000 }
  )

  // Load recent symbols from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('technical_recent_symbols')
    if (stored) {
      try {
        setRecentSymbols(JSON.parse(stored))
      } catch {}
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      const newSymbol = searchQuery.trim().toUpperCase().replace(/[^A-Z.-]/g, '')
      if (newSymbol) {
        setSymbol(newSymbol)
        // Update recent symbols
        const updated = [newSymbol, ...recentSymbols.filter(s => s !== newSymbol)].slice(0, 5)
        setRecentSymbols(updated)
        localStorage.setItem('technical_recent_symbols', JSON.stringify(updated))
      }
      setSearchQuery('')
    }
  }

  const handleRecentClick = (sym: string) => {
    setSymbol(sym)
    setSearchQuery('')
  }

  const formatPrice = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '—'
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getTrendColor = (trend: string) => {
    if (trend === 'BULLISH') return 'text-green-400'
    if (trend === 'BEARISH') return 'text-red-400'
    return 'text-slate-400'
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
          <form onSubmit={handleSearch} className="mb-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter stock symbol (e.g., AAPL, TSLA)"
                  className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Stock symbol input"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                aria-label="Analyze stock"
              >
                Analyze
              </button>
            </div>
          </form>
          {recentSymbols.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              <span className="text-sm text-slate-400 mr-2">Recent:</span>
              {recentSymbols.map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleRecentClick(sym)}
                  className="px-3 py-1 text-sm bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition"
                >
                  {sym}
                </button>
              ))}
            </div>
          )}
        </Reveal>

        {isLoading ? (
          <Reveal variant="fade">
            <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700 shadow-lg">
              <div className="animate-pulse space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-20 bg-slate-700 rounded"></div>
                  <div className="h-20 bg-slate-700 rounded"></div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-16 bg-slate-700 rounded"></div>
                  <div className="h-16 bg-slate-700 rounded"></div>
                </div>
              </div>
            </div>
          </Reveal>
        ) : error || data?.error ? (
          <Reveal variant="fade">
            <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
              <p className="text-red-400">
                {error?.message || data?.error || 'Failed to load technical analysis'}
                {error?.status === 404 && ' Symbol not found.'}
              </p>
            </div>
          </Reveal>
        ) : data?.calc ? (
          <>
            <Reveal variant="fade" delay={0.2}>
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{data.symbol}</h2>
                    <p className="text-slate-400">Technical Analysis</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-green-600/20 text-green-400 text-xs font-semibold rounded-full">
                      {data.provider || 'groq-llama'}
                    </span>
                    <span className="text-slate-500 text-sm">
                      {data.latency_ms ? `${data.latency_ms}ms` : ''}
                    </span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <div>
                      <div className="text-sm text-slate-400 mb-2">Trend</div>
                      <div className={`text-3xl font-bold ${getTrendColor(data.calc.trend)}`}>
                        {data.calc.trend || 'RANGE'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400 mb-2">Support Level</div>
                      {data.calc.support !== null ? (
                        <div className="text-xl font-semibold text-green-400">
                          {formatPrice(data.calc.support)}
                        </div>
                      ) : (
                        <div className="text-xl font-semibold text-slate-500">
                          — <span className="text-xs text-slate-500 ml-2" title="Not enough data">Not enough data</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-slate-400 mb-2">Resistance Level</div>
                      {data.calc.resistance !== null ? (
                        <div className="text-xl font-semibold text-red-400">
                          {formatPrice(data.calc.resistance)}
                        </div>
                      ) : (
                        <div className="text-xl font-semibold text-slate-500">
                          — <span className="text-xs text-slate-500 ml-2" title="Not enough data">Not enough data</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-slate-400 mb-3">Patterns Detected</div>
                      {data.calc.patterns && data.calc.patterns.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {data.calc.patterns.map((pattern: string, i: number) => (
                            <span key={i} className="px-3 py-1 bg-blue-600/20 text-blue-400 text-sm rounded">
                              {pattern}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="px-3 py-1 bg-slate-700/50 text-slate-400 text-sm rounded border border-slate-600">
                          No pattern detected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div>
                      <div className="text-sm text-slate-400 mb-2">Momentum Score</div>
                      {data.calc.momentum_score !== null ? (
                        <div>
                          <div className="text-3xl font-bold text-white mb-2">
                            {data.calc.momentum_score} / 100
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                              style={{ width: `${data.calc.momentum_score}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">
                          Momentum score unavailable.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* AI Summary */}
            {data.explain && (
              <Reveal variant="fade" delay={0.3}>
                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 mb-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-white mb-3">AI Summary</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-slate-300 leading-relaxed">
                        {data.explain.thesis || 'Technical analysis based on current market data.'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">
                        {data.explain.risk || 'Past performance does not guarantee future results.'}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            )}

            {/* Single Disclaimer */}
            <Reveal variant="fade" delay={0.4}>
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
                <p className="text-yellow-400 text-sm">
                  ⚠️ Not financial advice. Technical analysis is for informational purposes only. Always do your own research and consult with a financial advisor.
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

export default function TechnicalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
      <AIGate title="Technical Analysis">
        <TechnicalContent />
      </AIGate>
    </Suspense>
  )
}
