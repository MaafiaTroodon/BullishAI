'use client'

import { useState, useEffect } from 'react'
import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'
import { HelpCircle, ArrowLeft, Search, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function ShouldBuyPage() {
  const searchParams = useSearchParams()
  const [symbol, setSymbol] = useState(searchParams.get('symbol')?.toUpperCase() || 'AAPL')
  const [searchQuery, setSearchQuery] = useState('')

  const { data, error, isLoading } = useSWR(
    symbol ? `/api/ai/should-buy?symbol=${symbol}` : null,
    fetcher,
    { refreshInterval: 300000 }
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setSymbol(searchQuery.trim().toUpperCase())
    }
  }

  const getVerdictColor = (verdict: string) => {
    if (verdict === 'Buy') return 'text-green-400'
    if (verdict === 'Sell') return 'text-red-400'
    return 'text-yellow-400'
  }

  const getVerdictIcon = (verdict: string) => {
    if (verdict === 'Buy') return <CheckCircle className="w-6 h-6 text-green-400" />
    if (verdict === 'Sell') return <XCircle className="w-6 h-6 text-red-400" />
    return <AlertCircle className="w-6 h-6 text-yellow-400" />
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
            <HelpCircle className="w-8 h-8 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">Should I Buy?</h1>
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
              <p className="text-red-400">Error: {error?.message || data?.error || 'Failed to load analysis'}</p>
            </div>
          </Reveal>
        ) : data?.analysis ? (
          <>
            <Reveal variant="fade" delay={0.2}>
              <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{data.symbol}</h2>
                    <p className="text-slate-400">Investment Analysis</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-yellow-600/20 text-yellow-400 text-xs font-semibold rounded-full">
                      {data.model || 'groq-llama'}
                    </span>
                    <span className="text-slate-500 text-sm">
                      {data.latency ? `${data.latency}ms` : ''}
                    </span>
                  </div>
                </div>

                {/* Verdict */}
                <div className="bg-slate-900/50 rounded-lg p-6 mb-6 border border-slate-700">
                  <div className="flex items-center gap-4 mb-4">
                    {getVerdictIcon(data.analysis.verdict)}
                    <div>
                      <div className="text-sm text-slate-400 mb-1">Verdict</div>
                      <div className={`text-3xl font-bold ${getVerdictColor(data.analysis.verdict)}`}>
                        {data.analysis.verdict || 'HOLD'}
                      </div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-sm text-slate-400 mb-1">Confidence</div>
                      <div className="text-2xl font-bold text-white">
                        {data.analysis.confidence || 5}/10
                      </div>
                    </div>
                  </div>
                </div>

                {/* Thesis */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Investment Thesis</h3>
                  <p className="text-slate-300 leading-relaxed">
                    {data.analysis.thesis || 'Analysis unavailable'}
                  </p>
                </div>

                {/* Entry/Exit */}
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Entry Considerations</h3>
                    <p className="text-slate-300 leading-relaxed text-sm">
                      {data.analysis.entryConsiderations || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Exit Strategy</h3>
                    <p className="text-slate-300 leading-relaxed text-sm">
                      {data.analysis.exitStrategy || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Risks */}
                {data.analysis.risks && data.analysis.risks.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Key Risks</h3>
                    <ul className="space-y-2">
                      {data.analysis.risks.map((risk: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-slate-300">
                          <span className="text-red-400 mt-1">•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                  <p className="text-red-400 text-sm font-semibold mb-2">
                    {data.analysis.disclaimer || '⚠️ NOT FINANCIAL ADVICE'}
                  </p>
                  <p className="text-red-300 text-xs">
                    This analysis is for informational purposes only. Always consult with a financial advisor before making investment decisions.
                  </p>
                </div>
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

