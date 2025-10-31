'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, TrendingUp, TrendingDown, Settings, LogOut, User as UserIcon, Bell, ChevronDown } from 'lucide-react'
import useSWR from 'swr'
import { StockChart } from '@/components/charts/StockChart'
import { NewsFeed } from '@/components/NewsFeed'
import { DevStatus } from '@/components/DevStatus'
import { AIInsights } from '@/components/AIInsights'
import dynamic from 'next/dynamic'
const PortfolioChartComp = dynamic(() => import('@/components/PortfolioChart').then(m => m.PortfolioChart), { ssr: false })
const PortfolioHoldingsComp = dynamic(() => import('@/components/PortfolioHoldings').then(m => m.PortfolioHoldings), { ssr: false })
const PortfolioSummaryComp = dynamic(() => import('@/components/PortfolioSummary').then(m => m.PortfolioSummary), { ssr: false })

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    const text = await res.text()
    console.error('Non-JSON response:', text.substring(0, 200))
    throw new Error('Invalid response format')
  }
  return res.json()
}
const DEFAULT_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX']

export default function Dashboard() {
  const router = useRouter()
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
  const [searchQuery, setSearchQuery] = useState('')
  const [chartRange, setChartRange] = useState('1d')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [watchlistItems, setWatchlistItems] = useState<string[]>([])
  const [isClient, setIsClient] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Load watchlist from localStorage
  useEffect(() => {
    setIsClient(true)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('watchlistItems')
      if (saved) {
        const items = JSON.parse(saved)
        setWatchlistItems(items)
      } else {
        setWatchlistItems(DEFAULT_STOCKS)
      }
    }
  }, [])

  // Batch fetch quotes for watchlist
  const { data: batchQuotesData, isLoading: isLoadingBatchQuotes } = useSWR(
    watchlistItems.length > 0 ? `/api/quotes?symbols=${watchlistItems.join(',')}` : null,
    fetcher,
    { refreshInterval: 30000 }
  )

  const batchQuotes = batchQuotesData?.quotes || []

  // Handle search with suggestions
  const handleSearchChange = async (value: string) => {
    setSearchQuery(value)
    if (value.length >= 2) {
      try {
        const response = await fetch(`/api/search?query=${encodeURIComponent(value)}`)
        const data = await response.json()
        if (data.results) {
          setSearchSuggestions(data.results)
          setShowSuggestions(true)
        }
      } catch (error) {
        console.error('Search error:', error)
      }
    } else {
      setShowSuggestions(false)
    }
  }

  const handleSelectSuggestion = (symbol: string, name: string) => {
    router.push(`/stocks/${symbol}`)
    setSearchQuery('')
    setShowSuggestions(false)
    setSearchSuggestions([])
  }

  const { data: quote, isLoading: isLoadingQuote } = useSWR(
    `/api/quote?symbol=${selectedSymbol}`,
    fetcher,
    { refreshInterval: 15000 }
  )

  const { data: chartApiData, isLoading: isLoadingChart } = useSWR(
    `/api/chart?symbol=${selectedSymbol}&range=${chartRange}`,
    fetcher
  )

  const { data: newsData, isLoading: isLoadingNews } = useSWR(
    `/api/news?symbol=${selectedSymbol}`,
    fetcher
  )

  return (
    <div className="min-h-screen bg-slate-900">
      <DevStatus />
      {/* Header removed; GlobalNavbar renders from app/layout.tsx */}

      <main className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Portfolio Overview - Wealthsimple style */}
        <div className="space-y-6">
          {/* Summary Card at top - shows total balance and return */}
          <PortfolioSummaryComp />
          
          {/* Large prominent chart */}
          <PortfolioChartComp />
          
          {/* Holdings list below */}
          <PortfolioHoldingsComp />
        </div>
        
      </main>
    </div>
  )
}

