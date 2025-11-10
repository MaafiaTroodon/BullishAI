'use client'

import { useEffect, useState } from 'react'
import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'
import { Zap, ArrowLeft } from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function MomentumPage() {
  const { data, error, isLoading } = useSWR('/api/screeners/momentum?window=5d', fetcher, {
    refreshInterval: 60000,
  })

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
            <Zap className="w-8 h-8 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">Strongest Momentum</h1>
          </div>
        </Reveal>

        {isLoading ? (
          <Reveal variant="fade">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
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
                5 stocks with strongest short-term momentum (5-day performance)
              </p>
            </Reveal>

            <div className="space-y-4">
              {data?.stocks?.slice(0, 5).map((stock: any, idx: number) => (
                <Reveal key={stock.symbol || idx} variant="rise" delay={idx * 0.1}>
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
                          {idx + 1}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{stock.symbol}</h3>
                          <p className="text-sm text-slate-400">{stock.name || stock.symbol}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white mb-1">${stock.price?.toFixed(2)}</div>
                        <div className={`text-lg font-semibold ${stock.momentum_5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stock.momentum_5d >= 0 ? '+' : ''}{stock.momentum_5d?.toFixed(2)}%
                        </div>
                        <div className="text-sm text-slate-400 mt-1">5-day momentum</div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

