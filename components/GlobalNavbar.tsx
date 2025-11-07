'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Bell, ChevronDown, Settings, LogOut, TrendingUp, Calendar, Newspaper, History } from 'lucide-react'
import { DevStatus } from './DevStatus'
import useSWR from 'swr'

export function GlobalNavbar() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { data: wallet, mutate: mutateWallet } = useSWR('/api/wallet', (url)=>fetch(url).then(r=>r.json()), { refreshInterval: 10000 })
  useEffect(() => {
    function onWalletUpd() { mutateWallet() }
    window.addEventListener('walletUpdated', onWalletUpd as any)
    return () => window.removeEventListener('walletUpdated', onWalletUpd as any)
  }, [mutateWallet])

  // Handle search
  const handleSearchChange = async (value: string) => {
    setSearchQuery(value)
    if (value.length >= 2) {
      try {
        const response = await fetch(`/api/search?query=${encodeURIComponent(value)}`)
        if (!response.ok) {
          console.error('Search API error:', response.status, response.statusText)
          setSearchSuggestions([])
          setShowSuggestions(false)
          return
        }
        const data = await response.json()
        if (data.results && Array.isArray(data.results)) {
          setSearchSuggestions(data.results)
          setShowSuggestions(data.results.length > 0)
        } else {
          setSearchSuggestions([])
          setShowSuggestions(false)
        }
      } catch (error) {
        console.error('Search error:', error)
        setSearchSuggestions([])
        setShowSuggestions(false)
      }
    } else {
      setSearchSuggestions([])
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

            {/* Big Search Bar in Navbar */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-3xl mx-8 relative">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
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
                  className="w-full pl-12 pr-4 py-3 text-lg bg-slate-800 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-slate-800 border-2 border-slate-700 rounded-xl shadow-xl max-h-80 overflow-y-auto">
                    {searchSuggestions.map((item, idx) => (
                      <button
                        key={`${item.symbol}-${idx}`}
                        type="button"
                        onClick={() => handleSelectSuggestion(item.symbol, item.name)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-700 transition text-white border-b border-slate-700 last:border-b-0"
                      >
                        <div className="font-semibold text-lg">{item.symbol}</div>
                        <div className="text-sm text-slate-400">{item.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </form>

            <div className="hidden md:flex items-center space-x-4 pill-nav-container">
              <nav className="pill-nav-items" aria-label="Primary">
                <ul className="pill-list">
                  <li>
                    <Link href="/dashboard" className="pill">
                      <span className="hover-circle" aria-hidden="true" />
                      <span className="label-stack">
                        <span className="pill-label">Dashboard</span>
                        <span className="pill-label-hover" aria-hidden="true">Dashboard</span>
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link href="/watchlist" className="pill">
                      <span className="hover-circle" aria-hidden="true" />
                      <span className="label-stack">
                        <span className="pill-label">Watchlist</span>
                        <span className="pill-label-hover" aria-hidden="true">Watchlist</span>
                      </span>
                    </Link>
                  </li>
                  <li className="relative group">
                    <button
                      className="pill"
                      aria-expanded={false}
                      aria-haspopup="true"
                      onMouseEnter={() => {}}
                      onMouseLeave={() => {}}
                    >
                      <span className="hover-circle" aria-hidden="true" />
                      <span className="label-stack">
                        <span className="pill-label">Watch More</span>
                        <span className="pill-label-hover" aria-hidden="true">Watch More</span>
                      </span>
                    </button>
                    <div className="absolute left-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out z-50">
                      <Link
                        href="/news"
                        className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700 rounded-t-lg transition"
                        onMouseEnter={(e) => e.currentTarget.classList.add('bg-slate-700')}
                        onMouseLeave={(e) => e.currentTarget.classList.remove('bg-slate-700')}
                      >
                        <Newspaper className="h-4 w-4" />
                        <span>News</span>
                      </Link>
                      <Link
                        href="/calendar"
                        className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700 transition"
                        onMouseEnter={(e) => e.currentTarget.classList.add('bg-slate-700')}
                        onMouseLeave={(e) => e.currentTarget.classList.remove('bg-slate-700')}
                      >
                        <Calendar className="h-4 w-4" />
                        <span>Calendar</span>
                      </Link>
                      <Link
                        href="/history"
                        className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700 rounded-b-lg transition"
                        onMouseEnter={(e) => e.currentTarget.classList.add('bg-slate-700')}
                        onMouseLeave={(e) => e.currentTarget.classList.remove('bg-slate-700')}
                      >
                        <History className="h-4 w-4" />
                        <span>History</span>
                      </Link>
                    </div>
                  </li>
                  <li>
                    <Link href="/alerts" className="pill">
                      <span className="hover-circle" aria-hidden="true" />
                      <span className="label-stack">
                        <span className="pill-label">Alerts</span>
                        <span className="pill-label-hover" aria-hidden="true">Alerts</span>
                      </span>
                    </Link>
                  </li>
                </ul>
              </nav>
              {/* Wallet balance pill */}
              <Link href="/wallet" className="hidden lg:flex items-center bg-slate-800 border border-slate-700 rounded-full px-3 py-1 text-slate-200 font-semibold hover:bg-slate-700 transition">
                <span className="text-slate-400 mr-2">Wallet</span>
                <span>${(wallet?.balance ?? 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
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

