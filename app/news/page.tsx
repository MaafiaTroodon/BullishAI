'use client'

import { useState } from 'react'
import { Clock, ExternalLink, Newspaper } from 'lucide-react'
import useSWR from 'swr'
import { NewsFeed } from '@/components/NewsFeed'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function NewsPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: newsData, isLoading } = useSWR(
    searchQuery ? `/api/news?symbol=${searchQuery}` : null,
    fetcher
  )

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Market News</h1>
          <p className="text-slate-400">Stay updated with the latest market news</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              placeholder="Search for stock news (e.g., AAPL, TSLA, MSFT)"
              className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Search
            </button>
          </div>
        </div>

        {/* News Feed */}
        {isLoading ? (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <p className="text-slate-400">Loading news...</p>
          </div>
        ) : newsData && newsData.news ? (
          <NewsFeed news={newsData.news} symbol={searchQuery || 'Market'} />
        ) : (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex flex-col items-center justify-center py-12">
              <Newspaper className="h-16 w-16 text-slate-500 mb-4" />
              <p className="text-slate-400 text-lg mb-2">No news found</p>
              <p className="text-slate-500 text-sm">Search for a stock symbol to see related news</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

