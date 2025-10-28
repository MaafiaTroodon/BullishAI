'use client'

import { useState } from 'react'
import { Clock, ExternalLink, Newspaper, Search, TrendingUp, Zap } from 'lucide-react'
import useSWR from 'swr'
import { GlobalNavbar } from '@/components/GlobalNavbar'
import Link from 'next/link'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface NewsItem {
  title: string
  url: string
  source: string
  publishedAt: string
  summary?: string
}

export default function NewsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch top market news
  const { data: topNewsData, isLoading: isLoadingTopNews } = useSWR(
    '/api/news?symbol=MARKET',
    fetcher,
    { refreshInterval: 3600000 } // Refresh every hour
  )

  // Fetch search results
  const { data: searchNewsData, isLoading: isLoadingSearch } = useSWR(
    searchQuery ? `/api/news?symbol=${searchQuery}` : null,
    fetcher
  )

  // Determine which data to use
  const newsData = searchQuery ? searchNewsData : topNewsData
  const isLoading = searchQuery ? isLoadingSearch : isLoadingTopNews
  const news: NewsItem[] = newsData?.articles || newsData?.news || []

  const formatDate = (dateInput: string | number) => {
    let date: Date
    
    // Handle Unix timestamp (seconds or milliseconds)
    if (typeof dateInput === 'number') {
      // If timestamp is in seconds (less than 10000000000), convert to milliseconds
      date = new Date(dateInput < 10000000000 ? dateInput * 1000 : dateInput)
    } else {
      date = new Date(dateInput)
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      // Return current date if invalid
      date = new Date()
    }
    
    return {
      date: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <GlobalNavbar />
      
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Market News</h1>
          <p className="text-slate-400">Stay updated with the latest market news</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="flex gap-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && searchQuery) {
                  setSearchQuery(searchQuery.toUpperCase())
                }
              }}
              placeholder="Search for stock news (e.g., AAPL, TSLA, MSFT)"
              className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={() => {
                if (searchQuery) {
                  setSearchQuery(searchQuery.toUpperCase())
                }
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Search
            </button>
          </div>
        </div>

        {/* News Cards */}
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-slate-800 rounded-lg p-6 border border-slate-700 animate-pulse">
                <div className="h-6 bg-slate-700 rounded mb-3"></div>
                <div className="h-4 bg-slate-700 rounded mb-2"></div>
                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : news.length > 0 ? (
          <div className="grid gap-4">
            {news.slice(0, 20).map((item: any, index: number) => {
              // Handle different date formats
              const dateValue = item.publishedAt || item.datetime || item.time_published || Date.now()
              const formatted = formatDate(dateValue)
              return (
                <Link
                  key={index}
                  href={item.url || item.link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-blue-500 transition cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition">
                        {item.title || item.headline}
                      </h3>
                      {(item.summary || item.description) && (
                        <p className="text-slate-400 mb-3 line-clamp-2">
                          {item.summary || item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{formatted.date} • {formatted.time}</span>
                        </div>
                        <span className="text-blue-500">
                          {item.source?.name || item.source || item.provider}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="h-6 w-6 text-slate-500 group-hover:text-blue-500 transition flex-shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex flex-col items-center justify-center py-12">
              <Newspaper className="h-16 w-16 text-slate-500 mb-4" />
              <p className="text-slate-400 text-lg mb-2">No news found</p>
              <p className="text-slate-500 text-sm">Search for a stock symbol to see related news</p>
            </div>
          </div>
        )}

        {/* Last Update Info */}
        {!isLoading && news.length > 0 && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full">
              <Zap className="h-4 w-4 text-white" />
              <span className="text-white text-sm font-semibold">
                AI-Curated News • Powered by Groq Llama-3
              </span>
            </div>
            <div className="mt-4 text-slate-500 text-sm">
              Last updated: {new Date().toLocaleTimeString()} • Showing {news.length} top market news stories
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

