'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'
import { TrendingUp, ArrowLeft } from 'lucide-react'
import useSWR from 'swr'
import { authClient } from '@/lib/auth-client'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const themes = [
  { id: 'value', label: 'Value', description: 'Undervalued stocks with strong fundamentals' },
  { id: 'quality', label: 'Quality', description: 'High-quality companies with consistent performance' },
  { id: 'momentum', label: 'Momentum', description: 'Stocks with strong price momentum' },
  { id: 'dividend', label: 'Dividend', description: 'High-yield dividend stocks' },
]

export default function TopPicksPage() {
  const [selectedTheme, setSelectedTheme] = useState('value')
  const { data: session, isPending } = authClient.useSession()
  const isLoggedIn = !!session?.user

  // Use direct screener endpoints instead of AI screener to avoid JSON format issues
  const getEndpoint = () => {
    if (selectedTheme === 'value') return '/api/screeners/value-quality'
    if (selectedTheme === 'momentum') return '/api/screeners/momentum?window=5d'
    if (selectedTheme === 'dividend') return '/api/screeners/dividend-momentum'
    return '/api/screeners/value-quality' // quality uses value-quality
  }

  const { data, error, isLoading } = useSWR(
    getEndpoint(),
    fetcher,
    { refreshInterval: 300000 }
  )

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
            <TrendingUp className="w-8 h-8 text-indigo-400" />
            <h1 className="text-4xl font-bold text-white">Top Stock Picks</h1>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={0.1}>
          <div className="flex flex-wrap gap-3 mb-8">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSelectedTheme(theme.id)}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  selectedTheme === theme.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </Reveal>

        {isPending ? (
          <Reveal variant="fade">
            <div className="text-slate-300">Loading...</div>
          </Reveal>
        ) : isLoading ? (
          <Reveal variant="fade">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 animate-pulse">
                  <div className="h-4 bg-slate-700 rounded w-1/2 mb-4"></div>
                  <div className="h-4 bg-slate-700 rounded w-full mb-2"></div>
                  <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </Reveal>
        ) : error || data?.error ? (
          <Reveal variant="fade">
            <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
              <p className="text-red-400">Error: {error?.message || data?.error || 'Failed to load picks'}</p>
            </div>
          </Reveal>
        ) : (
          <>
            <Reveal variant="fade" delay={0.2}>
              <div className="mb-6">
                <p className="text-slate-400">
                  {themes.find(t => t.id === selectedTheme)?.description}
                </p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data?.stocks?.slice(0, isLoggedIn ? 10 : 3).map((stock: any, idx: number) => {
                // Handle different data formats from different endpoints
                const changePercent = stock.changePercent || stock.change || 0
                const price = stock.price || 0
                const name = stock.name || stock.symbol
                
                return (
                  <Reveal key={`top-pick-${stock.symbol || 'stock'}-${idx}`} variant="rise" delay={idx * 0.05}>
                    <Link href={`/stocks/${stock.symbol}`}>
                      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-blue-500/50 transition cursor-pointer h-full">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-white">{stock.symbol}</h3>
                            <p className="text-sm text-slate-400">{name}</p>
                          </div>
                          <div className={`text-right ${changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            <div className="text-lg font-semibold">
                              {changePercent >= 0 ? '+' : ''}{changePercent?.toFixed(2)}%
                            </div>
                            <div className="text-sm text-slate-400">${price?.toFixed(2)}</div>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <span className="px-2 py-1 bg-indigo-600/20 text-indigo-400 text-xs font-semibold rounded">
                            {selectedTheme === 'value'
                              ? (stock.valueLabel || 'Value')
                              : selectedTheme === 'quality'
                              ? (stock.qualityLabel || 'Quality')
                              : selectedTheme === 'momentum'
                              ? (stock.momentumLabel || 'Momentum')
                              : selectedTheme === 'dividend'
                              ? (stock.dividendLabel || (stock.dividend_yield ? `Yield ${stock.dividend_yield.toFixed(1)}%` : 'Dividend'))
                              : 'Recommended'}
                          </span>
                        </div>
                        
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {stock.rationale ||
                            (selectedTheme === 'value'
                              ? 'Valuation is in-line with peers based on available fundamentals.'
                              : selectedTheme === 'momentum'
                              ? `Recent momentum: ${stock.momentum_5d?.toFixed(2)}%`
                              : selectedTheme === 'dividend'
                              ? `Dividend yield: ${stock.dividend_yield?.toFixed(1)}% with stable payouts`
                              : 'Strong fundamentals with steady performance.')}
                        </p>
                      </div>
                    </Link>
                  </Reveal>
                )
              })}
            </div>

            {!isLoggedIn && (
              <Reveal variant="fade" delay={0.25}>
                <div className="mt-6 bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center">
                  <p className="text-slate-200 font-semibold mb-2">Log in to view the full list</p>
                  <p className="text-sm text-slate-400 mb-3">See 10+ picks, expanded rationale, and more AI tools.</p>
                  <div className="flex items-center justify-center gap-3">
                    <Link href="/auth/signin" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500">
                      Sign In
                    </Link>
                    <Link href="/auth/signup" className="px-4 py-2 rounded-lg bg-slate-700 text-slate-100 text-sm font-semibold hover:bg-slate-600">
                      Sign Up
                    </Link>
                  </div>
                </div>
              </Reveal>
            )}

            {(!data?.stocks || data.stocks.length === 0) && (
              <Reveal variant="fade">
                <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 text-center">
                  <p className="text-slate-400">No picks available for this theme at this time.</p>
                </div>
              </Reveal>
            )}

            <Reveal variant="fade" delay={0.3}>
              <div className="mt-6 bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
                <p className="text-yellow-400 text-sm">
                  ⚠️ Not financial advice. Stock picks are for informational purposes only.
                </p>
              </div>
            </Reveal>
          </>
        )}
        </div>
      </div>
  )
}
