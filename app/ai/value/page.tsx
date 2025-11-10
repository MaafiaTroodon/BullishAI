'use client'

import { useEffect, useState } from 'react'
import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'
import { DollarSign, ArrowLeft } from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function ValuePage() {
  const { data, error, isLoading } = useSWR('/api/screeners/value-quality', fetcher, {
    refreshInterval: 300000,
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
            <DollarSign className="w-8 h-8 text-green-400" />
            <h1 className="text-4xl font-bold text-white">Best Value Stocks</h1>
          </div>
        </Reveal>

        {isLoading ? (
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
              <p className="text-red-400">Error: {error?.message || data?.error}</p>
            </div>
          </Reveal>
        ) : (
          <>
            <Reveal variant="fade" delay={0.1}>
              <p className="text-slate-400 mb-6">
                High-quality stocks offering the best value this week (PE &lt; 15, ROE &gt; 15%, Revenue Growth &gt; 10%)
              </p>
            </Reveal>

            {data?.stocks && data.stocks.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.stocks.map((stock: any, idx: number) => (
                  <Reveal key={stock.symbol || idx} variant="rise" delay={idx * 0.05}>
                    <Link href={`/stocks/${stock.symbol}`}>
                      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-blue-500/50 transition cursor-pointer h-full">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-white">{stock.symbol}</h3>
                            <p className="text-sm text-slate-400">{stock.name || stock.symbol}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-white">${stock.price?.toFixed(2)}</div>
                            <div className={`text-sm ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {stock.change >= 0 ? '+' : ''}{stock.change?.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs font-semibold rounded">
                            Analyst Undervalued
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-slate-400 mb-1">P/E</div>
                            <div className="font-semibold text-white">{stock.pe?.toFixed(1)}</div>
                          </div>
                          <div>
                            <div className="text-slate-400 mb-1">ROE</div>
                            <div className="font-semibold text-white">{stock.roe?.toFixed(1)}%</div>
                          </div>
                          <div>
                            <div className="text-slate-400 mb-1">Growth</div>
                            <div className="font-semibold text-white">{stock.revenue_growth?.toFixed(1)}%</div>
                          </div>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-slate-700">
                          <div className="text-xs text-slate-400">
                            Quality Score: <span className="text-white font-semibold">{stock.quality_score?.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            ) : (
              <Reveal variant="fade">
                <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 text-center">
                  <p className="text-slate-400">No value stocks found matching the criteria. Try again in a moment.</p>
                </div>
              </Reveal>
            )}
          </>
        )}
      </div>
    </div>
  )
}

