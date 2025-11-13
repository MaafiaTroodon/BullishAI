'use client'
export const dynamic = 'force-dynamic'

import { Suspense, useState } from 'react'
import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'
import { Search as SearchIcon, ArrowLeft, ExternalLink, FileText } from 'lucide-react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function ResearchContent() {
  const searchParams = useSearchParams()
  const [symbol, setSymbol] = useState(searchParams.get('symbol')?.toUpperCase() || 'AAPL')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: quote } = useSWR(`/api/quote?symbol=${symbol}`, fetcher, { refreshInterval: 30000 })
  const { data: news } = useSWR(`/api/news?symbol=${symbol}`, fetcher, { refreshInterval: 60000 })
  const { data: stockData } = useSWR(`/api/stocks?symbol=${symbol}`, fetcher, { refreshInterval: 300000 })

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
            <SearchIcon className="w-8 h-8 text-pink-400" />
            <h1 className="text-4xl font-bold text-white">Stock Research</h1>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={0.1}>
          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
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
                Research
              </button>
            </div>
          </form>
        </Reveal>

        {symbol && (
          <>
            {/* Company Snapshot */}
            <Reveal variant="fade" delay={0.2}>
              <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">{symbol}</h2>
                    <p className="text-slate-400">{stockData?.name || quote?.name || 'Company Name'}</p>
                  </div>
                  {quote && (
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white mb-1">
                        ${quote.price?.toFixed(2)}
                      </div>
                      <div className={`text-lg font-semibold ${quote.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent?.toFixed(2)}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Market Cap</div>
                    <div className="text-lg font-semibold text-white">
                      {quote?.marketCap ? `$${(quote.marketCap / 1e9).toFixed(1)}B` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">P/E Ratio</div>
                    <div className="text-lg font-semibold text-white">
                      {quote?.peRatio || stockData?.pe || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Volume</div>
                    <div className="text-lg font-semibold text-white">
                      {quote?.volume ? (quote.volume / 1e6).toFixed(1) + 'M' : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">52W Range</div>
                    <div className="text-lg font-semibold text-white">
                      {quote?.high52w && quote?.low52w 
                        ? `$${quote.low52w.toFixed(2)} - $${quote.high52w.toFixed(2)}`
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Financials */}
            <Reveal variant="fade" delay={0.3}>
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mb-6">
                <h3 className="text-xl font-semibold text-white mb-4">Financials</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Revenue (TTM)</div>
                    <div className="text-lg font-semibold text-white">
                      {stockData?.revenue ? `$${(stockData.revenue / 1e9).toFixed(1)}B` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">EPS</div>
                    <div className="text-lg font-semibold text-white">
                      {stockData?.eps || quote?.eps || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Dividend Yield</div>
                    <div className="text-lg font-semibold text-white">
                      {stockData?.dividendYield ? `${stockData.dividendYield.toFixed(2)}%` : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Catalysts */}
            {news?.items && news.items.length > 0 && (
              <Reveal variant="fade" delay={0.4}>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mb-6">
                  <h3 className="text-xl font-semibold text-white mb-4">Recent Catalysts</h3>
                  <div className="space-y-3">
                    {news.items.slice(0, 5).map((item: any, idx: number) => (
                      <div key={idx} className="border-l-2 border-blue-500 pl-4">
                        <div className="font-semibold text-white mb-1">{item.headline}</div>
                        <div className="text-sm text-slate-400">{item.source} • {new Date(item.datetime).toLocaleDateString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            )}

            {/* SEC Filings */}
            <Reveal variant="fade" delay={0.5}>
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  SEC Filings
                </h3>
                <div className="space-y-2">
                  <a
                    href={`https://www.sec.gov/cgi-bin/browse-edgar?CIK=${symbol}&owner=exclude&action=getcompany`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View all SEC filings on SEC.gov
                  </a>
                  <p className="text-sm text-slate-400 mt-2">
                    Access 10-K, 10-Q, 8-K, and other regulatory filings directly from the SEC.
                  </p>
                </div>
              </div>
            </Reveal>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
      <ResearchContent />
    </Suspense>
  )
}

