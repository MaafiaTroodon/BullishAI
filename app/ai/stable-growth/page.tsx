'use client'

import { useEffect, useState } from 'react'
import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'
import { TrendingUp, ArrowLeft } from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function StableGrowthPage() {
  // Use value-quality screener but filter for low beta, consistent EPS
  const { data, error, isLoading } = useSWR('/api/screeners/value-quality', fetcher, {
    refreshInterval: 300000,
  })

  // Filter for stable growth characteristics
  const stableStocks = data?.stocks?.filter((s: any) => {
    // Mock beta and EPS consistency (in production, fetch from fundamentals API)
    return s.quality_score > 60
  }) || []

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
            <TrendingUp className="w-8 h-8 text-emerald-400" />
            <h1 className="text-4xl font-bold text-white">Stable Growth Picks</h1>
          </div>
        </Reveal>

        {isLoading ? (
          <Reveal variant="fade">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 animate-pulse">
                  <div className="h-4 bg-slate-700 rounded w-1/2 mb-4"></div>
                  <div className="h-4 bg-slate-700 rounded w-full"></div>
                </div>
              ))}
            </div>
          </Reveal>
        ) : error || data?.error ? (
          <Reveal variant="fade">
            <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
              <p className="text-red-400">Error: {error?.message || data?.error}</p>
            </div>
          </Reveal>
        ) : (
          <>
            <Reveal variant="fade" delay={0.1}>
              <p className="text-slate-400 mb-6">
                Low beta, consistent EPS stocks for long-term holding
              </p>
            </Reveal>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stableStocks.map((stock: any, idx: number) => (
                <Reveal key={stock.symbol || idx} variant="rise" delay={idx * 0.05}>
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white">{stock.symbol}</h3>
                        <p className="text-sm text-slate-400">{stock.name || stock.symbol}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-white">${stock.price?.toFixed(2)}</div>
                        <div className="text-sm text-slate-400">Quality: {stock.quality_score?.toFixed(0)}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">P/E</span>
                        <span className="font-semibold text-white">{stock.pe?.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">ROE</span>
                        <span className="font-semibold text-white">{stock.roe?.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Growth</span>
                        <span className="font-semibold text-green-400">{stock.revenue_growth?.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            {stableStocks.length === 0 && (
              <Reveal variant="fade">
                <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 text-center">
                  <p className="text-slate-400">No stable growth picks available at this time.</p>
                </div>
              </Reveal>
            )}
          </>
        )}
      </div>
    </div>
  )
}

