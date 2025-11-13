'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'
import { Target, ArrowLeft } from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function ReboundPage() {
  const { data, error, isLoading } = useSWR('/api/screeners/rebound', fetcher, {
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
            <Target className="w-8 h-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">Undervalued Rebound</h1>
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
                Undervalued stocks poised for a rebound (RSI &lt; 35, turning up)
              </p>
            </Reveal>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data?.stocks?.map((stock: any, idx: number) => {
                const recoveryScore = Math.max(0, Math.min(100, 100 - stock.rsi))
                return (
                  <Reveal key={`rebound-${stock.symbol || 'stock'}-${idx}`} variant="rise" delay={idx * 0.05}>
                    <Link href={`/stocks/${stock.symbol}`}>
                      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-blue-500/50 transition cursor-pointer h-full">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-white">{stock.symbol}</h3>
                            <p className="text-sm text-slate-400">{stock.name || stock.symbol}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-white">${stock.price?.toFixed(2)}</div>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <span className="px-2 py-1 bg-orange-600/20 text-orange-400 text-xs font-semibold rounded">
                            Recovery Potential
                          </span>
                        </div>
                        
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">RSI</span>
                            <span className="font-semibold text-white">{stock.rsi?.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Trend</span>
                            <span className={`font-semibold ${stock.rsi_trend === 'turning_up' ? 'text-green-400' : 'text-yellow-400'}`}>
                              {stock.rsi_trend === 'turning_up' ? 'Turning Up' : 'Oversold'}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Support</span>
                            <span className="font-semibold text-green-400">${stock.support_level?.toFixed(2)}</span>
                          </div>
                        </div>
                        
                        <div className="pt-3 border-t border-slate-700">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Recovery Score</span>
                            <span className="text-sm font-semibold text-white">{recoveryScore.toFixed(0)}/100</span>
                          </div>
                          <div className="w-full h-2 bg-slate-700 rounded-full mt-2 overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-orange-500 to-green-500"
                              style={{ width: `${recoveryScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </Reveal>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

