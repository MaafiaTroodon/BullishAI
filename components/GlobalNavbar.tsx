'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Bell, ChevronDown, Settings, LogOut, TrendingUp } from 'lucide-react'
import { DevStatus } from './DevStatus'

export function GlobalNavbar() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  // Handle search
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery && searchQuery.length <= 5) {
      router.push(`/stocks/${searchQuery.toUpperCase()}`)
    }
  }

  return (
    <>
      <DevStatus />
      <nav className="border-b border-slate-800 sticky top-0 z-50 bg-slate-900/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              <span className="ml-2 text-2xl font-bold text-white">BullishAI</span>
            </Link>

            {/* Search Bar in Navbar */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-2xl mx-8 relative">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200)
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && searchQuery) {
                      router.push(`/stocks/${searchQuery.toUpperCase()}`)
                      setShowSuggestions(false)
                    }
                  }}
                  placeholder="Search stocks (e.g., AAPL, TSLA, MSFT)"
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                    {searchSuggestions.map((item, idx) => (
                      <button
                        key={`${item.symbol}-${idx}`}
                        type="button"
                        onClick={() => handleSelectSuggestion(item.symbol, item.name)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-700 transition text-white border-b border-slate-700 last:border-b-0"
                      >
                        <div className="font-semibold">{item.symbol}</div>
                        <div className="text-sm text-slate-400">{item.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </form>

            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="hidden md:block mask-btn">
                Dashboard
              </Link>
              <Link href="/watchlist" className="hidden md:block mask-btn">
                Watchlist
              </Link>
              <Link href="/news" className="hidden md:block mask-btn">
                News
              </Link>
              <Link href="/alerts" className="hidden md:block mask-btn">
                Alerts
              </Link>
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                    JD
                  </div>
                  <span className="hidden md:inline">John Doe</span>
                  <ChevronDown className="h-4 w-4 hidden md:block" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
                    <Link href="/settings" className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-t-lg">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    <button 
                      onClick={() => {
                        alert('Logged out successfully!')
                        router.push('/')
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-b-lg text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}

