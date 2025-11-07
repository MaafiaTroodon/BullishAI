'use client'

import { useState, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import { safeJsonFetcher } from '@/lib/safeFetch'
import { formatETTime } from '@/lib/marketSession'
import { Download } from 'lucide-react'

type FilterType = 'all' | 'deposits' | 'withdrawals' | 'buys' | 'sells'

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<'wallet' | 'trades'>('wallet')
  const [filter, setFilter] = useState<FilterType>('all')

  // Fetch wallet transactions
  const { data: walletData, isLoading: isLoadingWallet, mutate: mutateWallet } = useSWR(
    activeTab === 'wallet' ? '/api/wallet/transactions' : null,
    safeJsonFetcher,
    { refreshInterval: 30000 }
  )

  // Fetch trade transactions
  const { data: tradesData, isLoading: isLoadingTrades, mutate: mutateTrades } = useSWR(
    activeTab === 'trades' ? '/api/portfolio/transactions' : null,
    safeJsonFetcher,
    { refreshInterval: 30000 }
  )

  // Listen for wallet updates
  useEffect(() => {
    const handleWalletUpdate = () => {
      if (activeTab === 'wallet') {
        mutateWallet()
      }
    }
    window.addEventListener('walletUpdated', handleWalletUpdate)
    return () => window.removeEventListener('walletUpdated', handleWalletUpdate)
  }, [activeTab, mutateWallet])

  // Listen for portfolio updates
  useEffect(() => {
    const handlePortfolioUpdate = () => {
      if (activeTab === 'trades') {
        mutateTrades()
      }
    }
    window.addEventListener('portfolioUpdated', handlePortfolioUpdate)
    return () => window.removeEventListener('portfolioUpdated', handlePortfolioUpdate)
  }, [activeTab, mutateTrades])

  const isLoading = activeTab === 'wallet' ? isLoadingWallet : isLoadingTrades
  const data = activeTab === 'wallet' ? walletData : tradesData

  // Process and filter transactions
  const processedTransactions = useMemo(() => {
    if (!data || !data.transactions || !Array.isArray(data.transactions)) {
      return []
    }

    let transactions = [...data.transactions]

    // Filter by type
    if (filter !== 'all') {
      if (activeTab === 'wallet') {
        if (filter === 'deposits') {
          transactions = transactions.filter((t: any) => t.action === 'deposit')
        } else if (filter === 'withdrawals') {
          transactions = transactions.filter((t: any) => t.action === 'withdraw')
        }
      } else {
        if (filter === 'buys') {
          transactions = transactions.filter((t: any) => t.action === 'buy')
        } else if (filter === 'sells') {
          transactions = transactions.filter((t: any) => t.action === 'sell')
        }
      }
    }

    // Sort by timestamp (newest first)
    transactions.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))

    // Group by date
    const grouped: Record<string, any[]> = {}
    transactions.forEach((t: any) => {
      const date = new Date(t.timestamp || 0)
      const dateKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(t)
    })

    return grouped
  }, [data, filter, activeTab])

  // Calculate running balance for wallet - FIX: Never drop when deposits are added
  const runningBalances = useMemo(() => {
    if (activeTab !== 'wallet' || !data?.transactions) return {}
    
    const balances: Record<number, number> = {}
    
    // Get all transactions (not filtered) for accurate running balance calculation
    const allTransactions = [...(data.transactions || [])].sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0))
    
    // Calculate running balance forward from the start
    // This ensures deposits always increase balance, never decrease it
    let runningBalance = 0
    
    allTransactions.forEach((t: any) => {
      if (t.action === 'deposit') {
        runningBalance += t.amount || 0
      } else if (t.action === 'withdraw') {
        runningBalance -= t.amount || 0
      }
      // Store balance AFTER this transaction
      balances[t.timestamp || 0] = runningBalance
    })
    
    return balances
  }, [data, activeTab])

  // Export to CSV with proper UTC ISO timestamps
  const handleExportCSV = () => {
    const rows: string[] = []
    
    if (activeTab === 'wallet') {
      rows.push('date_time_iso,type,amount,method,currency,running_wallet_balance_after')
      Object.entries(processedTransactions).forEach(([date, transactions]) => {
        transactions.forEach((t: any) => {
          const d = new Date(t.timestamp || 0)
          rows.push([
            d.toISOString(), // UTC ISO timestamp
            t.action === 'deposit' ? 'deposit' : 'withdrawal',
            (t.amount || 0).toFixed(2),
            t.method || 'EFT',
            'USD',
            (t.runningBalance !== undefined ? t.runningBalance : runningBalances[t.timestamp || 0] || 0).toFixed(2)
          ].join(','))
        })
      })
    } else {
      rows.push('date_time_iso,type,symbol,side,qty,price,fees,currency,account,order_id')
      Object.entries(processedTransactions).forEach(([date, transactions]) => {
        transactions.forEach((t: any) => {
          const d = new Date(t.timestamp || 0)
          rows.push([
            d.toISOString(), // UTC ISO timestamp
            t.action === 'buy' ? 'buy' : 'sell',
            t.symbol || '',
            t.action === 'buy' ? 'buy' : 'sell',
            (t.quantity || 0).toFixed(4),
            (t.price || 0).toFixed(2),
            (t.fees || 0).toFixed(2),
            'USD',
            t.account || '',
            t.order_id || ''
          ].join(','))
        })
      })
    }

    const csv = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const filterStr = filter === 'all' ? 'all' : filter
    a.download = `history_${new Date().toISOString().split('T')[0]}_${filterStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Transaction History</h1>
            <p className="text-slate-400">View all your wallet and trading activity</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-700" role="tablist">
          <button
            onClick={() => { setActiveTab('wallet'); setFilter('all') }}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'wallet'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
            aria-selected={activeTab === 'wallet'}
            role="tab"
          >
            Wallet
          </button>
          <button
            onClick={() => { setActiveTab('trades'); setFilter('all') }}
            className={`px-4 py-2 font-semibold transition ${
              activeTab === 'trades'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
            aria-selected={activeTab === 'trades'}
            role="tab"
          >
            Trades
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(activeTab === 'wallet' 
            ? ['all', 'deposits', 'withdrawals'] 
            : ['all', 'buys', 'sells']
          ).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as FilterType)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              <div className="h-4 bg-slate-700 rounded w-1/2"></div>
            </div>
          </div>
        ) : !data ? (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 text-center">
            <p className="text-slate-400">Loading transactions...</p>
          </div>
        ) : Object.keys(processedTransactions).length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 text-center">
            <p className="text-slate-400">
              {data?.transactions && Array.isArray(data.transactions) && data.transactions.length > 0
                ? `No ${activeTab} transactions found for the selected filter.`
                : `No ${activeTab} transactions found. Make a ${activeTab === 'wallet' ? 'deposit or withdrawal' : 'trade'} to see your history.`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(processedTransactions).map(([date, transactions]) => {
              const dayTotal = transactions.reduce((sum: number, t: any) => {
                if (activeTab === 'wallet') {
                  return sum + (t.action === 'deposit' ? (t.amount || 0) : -(t.amount || 0))
                } else {
                  return sum + ((t.quantity || 0) * (t.price || 0) + (t.fees || 0))
                }
              }, 0)

              return (
                <div key={date} className="bg-slate-800 rounded-lg border border-slate-700">
                  <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="font-semibold text-white">{date}</h3>
                    <span className="text-sm text-slate-400">
                      Total: {activeTab === 'wallet' ? '$' : ''}{dayTotal.toFixed(2)}{activeTab === 'trades' ? ' in trades' : ''}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-700">
                    {transactions.map((t: any, idx: number) => (
                      <div key={`${t.timestamp}-${idx}`} className="px-4 py-3 hover:bg-slate-700/50 transition">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              {activeTab === 'wallet' ? (
                                <>
                                  <span className={`font-semibold ${t.action === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>
                                    {t.action === 'deposit' ? 'Deposit' : 'Withdrawal'}
                                  </span>
                                  <span className="text-slate-400 text-sm">{t.method || 'Electronic funds transfer'}</span>
                                </>
                              ) : (
                                <>
                                  <span className={`font-semibold ${t.action === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                                    {t.action === 'buy' ? 'Buy' : 'Sell'}
                                  </span>
                                  <span className="font-bold text-white">{t.symbol}</span>
                                  <span className="text-slate-400 text-sm">
                                    {t.quantity?.toFixed(4)} shares @ ${(t.price || 0).toFixed(2)}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatETTime(new Date(t.timestamp || 0))}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-bold ${activeTab === 'wallet' && t.action === 'deposit' ? 'text-green-400' : activeTab === 'wallet' ? 'text-red-400' : 'text-white'}`}>
                              {activeTab === 'wallet' 
                                ? `${t.action === 'deposit' ? '+' : '-'}$${(t.amount || 0).toFixed(2)}`
                                : `$${((t.quantity || 0) * (t.price || 0) + (t.fees || 0)).toFixed(2)}`
                              }
                            </div>
                            {activeTab === 'wallet' && (
                              <div className="text-xs text-slate-500 mt-1">
                                Balance after: ${(t.resultingBalance !== undefined ? t.resultingBalance : (t.runningBalance !== undefined ? t.runningBalance : runningBalances[t.timestamp || 0] || 0)).toFixed(2)}
                              </div>
                            )}
                            {activeTab === 'trades' && t.fees > 0 && (
                              <div className="text-xs text-slate-500 mt-1">
                                Fees: ${(t.fees || 0).toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

