'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'
import { Star, ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import useSWR from 'swr'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.json()
}

export default function RecommendedPage() {
  const { data, error, isLoading } = useSWR('/api/ai/recommended', fetcher, {
    refreshInterval: 300000, // 5 minutes
  })

  const recommendations = data?.data || []
  const meta = data?.meta

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
            <Star className="w-8 h-8 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">Today's Recommended Stocks</h1>
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
        ) : error || data?.success === false ? (
          <Reveal variant="fade">
            <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
              <p className="text-red-400">
                Error: {error?.message || data?.error?.message || 'Failed to load recommendations'}
              </p>
            </div>
          </Reveal>
        ) : (
          <>
            <Reveal variant="fade" delay={0.1}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-purple-600/20 text-purple-400 text-xs font-semibold rounded-full uppercase">
                    {meta?.universe || 'ALL'}
                  </span>
                  <span className="text-slate-500 text-sm">
                    {meta?.asOf ? `As of ${new Date(meta.asOf).toLocaleTimeString()}` : ''}
                  </span>
                </div>
                <div className="text-slate-400 text-sm">
                  {meta?.count || recommendations.length} recommendations
                </div>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.map((stock: any, idx: number) => (
                <Reveal key={`recommended-${stock.symbol || 'stock'}-${idx}`} variant="rise" delay={idx * 0.05}>
                  <Link href={`/stocks/${stock.symbol}`}>
                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-blue-500/50 transition cursor-pointer h-full">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-white">{stock.symbol}</h3>
                          <p className="text-sm text-slate-400">{stock.name || stock.symbol}</p>
                        </div>
                        <div className={`text-right ${stock.chg1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          <div className="text-lg font-semibold">
                            {stock.chg1d >= 0 ? '+' : ''}{stock.chg1d?.toFixed(2)}%
                          </div>
                          <div className="text-sm text-slate-400">
                            ${stock.price?.toFixed(2)} • {stock.exchange}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-3 flex flex-wrap gap-2">
                        {stock.tags?.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs font-semibold rounded capitalize">
                            {tag.replace('-', ' ')}
                          </span>
                        ))}
                        <span className="px-2 py-1 bg-slate-700/40 text-slate-300 text-xs font-semibold rounded">
                          Score {stock.score ?? '--'}
                        </span>
                        <span className="px-2 py-1 bg-slate-700/40 text-slate-300 text-xs font-semibold rounded">
                          Vol⁄30d {stock.volRel30?.toFixed(2)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {stock.summary || 'High conviction signals across technical and flow factors.'}
                      </p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>

            {recommendations.length === 0 && (
              <Reveal variant="fade">
                <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 text-center">
                  <p className="text-slate-400">No recommendations available at this time.</p>
                </div>
              </Reveal>
            )}

            <Reveal variant="fade" delay={0.3}>
              <div className="mt-6 bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
                <p className="text-yellow-400 text-sm">
                  ⚠️ Not financial advice. Recommendations are for informational purposes only. Always do your own research.
                </p>
              </div>
            </Reveal>
          </>
        )}
      </div>
    </div>
  )
}

