'use client'

import useSWR, { useSWRConfig } from 'swr'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { MarketSessionBadge } from './MarketSessionBadge'
import { safeJsonFetcher } from '@/lib/safeFetch'
import { getMarketSession, getRefreshInterval } from '@/lib/marketSession'
import { useUserId, getUserStorageKey } from '@/hooks/useUserId'
import { authClient } from '@/lib/auth-client'
import { useFastPricePolling } from '@/hooks/useFastPricePolling'
import { createHoldingsMap, calculateMarkToMarketDelta } from '@/lib/portfolio-mark-to-market-fast'

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())

export function PortfolioSummary() {
  const userId = useUserId()
  const pathname = usePathname()
  const storageKey = getUserStorageKey('bullish_pf_positions', userId)
  const { data: session } = authClient.useSession()
  const { mutate: globalMutate } = useSWRConfig()
  
  // Get market session for dynamic refresh interval
  const marketSession = typeof window !== 'undefined' ? getMarketSession() : { session: 'CLOSED' as const }
  const refreshInterval = getRefreshInterval(marketSession.session)
  
  // Fast price polling will update this via cache mutations
  // Initial load only, then fast polling takes over
  const { data, isLoading, mutate } = useSWR(
    session?.user ? '/api/portfolio?enrich=1' : null,
    fetcher,
    { 
      // Initial load only - fast polling will update cache directly
      refreshInterval: 0,
      revalidateOnFocus: !!session?.user,
      revalidateOnReconnect: !!session?.user,
      // Dedupe requests to prevent duplicate fetches during navigation
      dedupingInterval: 2000,
      // Revalidate on mount to ensure fresh data on route changes
      revalidateOnMount: true,
      // Don't show error retry to prevent flicker
      shouldRetryOnError: false,
      // Prevent showing loading state during revalidation (SWR will use cached data)
      revalidateIfStale: true,
    }
  )
  
  // Clear cached data when user logs out
  useEffect(() => {
    if (!session?.user) {
      globalMutate('/api/portfolio?enrich=1', undefined, { revalidate: false })
      globalMutate('/api/portfolio/timeseries', undefined, { revalidate: false })
    }
  }, [session?.user, globalMutate])
  
  // Revalidate portfolio data on route change to ensure consistency
  // Use a ref to track last pathname to avoid unnecessary revalidations
  const lastPathnameRef = useRef<string | null>(null)
  useEffect(() => {
    if (userId && pathname !== lastPathnameRef.current) {
      lastPathnameRef.current = pathname
      // Only revalidate if we have existing data (to prevent initial $0 flicker)
      if (data) {
        mutate()
      }
    }
  }, [pathname, userId, mutate, data])
  const [localItems, setLocalItems] = useState<any[]>([])
  
  // Fetch timeseries for Net Deposits (Cost Basis) - more frequent during market hours for real-time
  // Only fetch when user is logged in
  const { data: timeseriesData } = useSWR(
    session?.user ? '/api/portfolio/timeseries?range=ALL&gran=1d' : null,
    safeJsonFetcher,
    { 
      refreshInterval: session?.user 
        ? (marketSession.session === 'REG' || marketSession.session === 'PRE' || marketSession.session === 'POST' ? 5000 : 30000)
        : 0 
    }
  )
  
  useEffect(() => {
    if (!storageKey) {
      setLocalItems([])
      return
    }
    
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const map = JSON.parse(raw)
        setLocalItems(Object.values(map))
      } else {
        setLocalItems([])
      }
      function onUpd() {
        if (!storageKey) {
          setLocalItems([])
          return
        }
        const r = localStorage.getItem(storageKey)
        if (r) {
          const map = JSON.parse(r)
          const items = Object.values(map).filter((p: any) => (p.totalShares || 0) > 0)
          setLocalItems(items)
        } else {
          setLocalItems([])
        }
        // Force immediate revalidation to get fresh data from API
        mutate()
      }
      window.addEventListener('portfolioUpdated', onUpd as any)
      return () => window.removeEventListener('portfolioUpdated', onUpd as any)
    } catch {
      setLocalItems([])
    }
  }, [mutate, storageKey])

  // Enrich local items if API data is not available
  const [enriched, setEnriched] = useState<any[]>([])
  // Always prioritize API data (even if empty) over localStorage
  // This ensures new users see empty state, not data from localStorage
  // But if API returns empty array and we have localItems, use localItems as fallback
  const items = (() => {
    if (data?.items !== undefined) {
      // If API has items, use them
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items
      }
      // If API returned empty array but we have localItems, use localItems
      if (Array.isArray(localItems) && localItems.length > 0) {
        return localItems
      }
      // Otherwise use API's empty array
      return data.items || []
    }
    // If no API data, use localItems
    return Array.isArray(localItems) ? localItems : []
  })()

  useEffect(() => {
    let cancelled = false
    async function enrich() {
      if (!Array.isArray(items) || items.length === 0) { 
        setEnriched([]); 
        return 
      }
      // If items already have currentPrice from API, use them
      if (items[0]?.currentPrice != null) { 
        setEnriched(items); 
        return 
      }
      try {
        const out: any[] = []
        await Promise.all(items.map(async (p: any) => {
          try {
            const r = await fetch(`/api/quote?symbol=${encodeURIComponent(p.symbol)}`, { cache: 'no-store' })
            const j = await r.json()
            const price = j?.data?.price ?? j?.price ?? null
            const totalValue = price ? price * p.totalShares : 0
            const base = (p.totalCost || p.avgPrice * p.totalShares) || 0
            const unreal = price ? (price - p.avgPrice) * p.totalShares : 0
            const unrealPct = base > 0 ? (unreal / base) * 100 : 0
            out.push({ 
              ...p, 
              currentPrice: price, 
              totalValue, 
              unrealizedPnl: unreal, 
              unrealizedPnlPct: unrealPct,
              totalCost: p.totalCost || p.avgPrice * p.totalShares 
            })
          } catch {
            const fallbackCost = p.totalCost || (p.avgPrice ? p.avgPrice * (p.totalShares || 0) : 0) || 0
            const fallbackValue = p.totalValue ?? fallbackCost
            const fallbackDelta = fallbackValue - fallbackCost
            out.push({ 
              ...p,
              currentPrice: p.currentPrice ?? null,
              totalValue: fallbackValue,
              unrealizedPnl: fallbackDelta,
              unrealizedPnlPct: fallbackCost > 0 ? (fallbackDelta / fallbackCost) * 100 : 0,
              totalCost: fallbackCost
            })
          }
        }))
        if (!cancelled) setEnriched(Array.isArray(out) ? out : [])
      } catch (error) {
        // On error, fall back to items if available
        if (!cancelled) {
          setEnriched(Array.isArray(items) ? items : [])
        }
      }
    }
    enrich()
    return () => { cancelled = true }
  }, [JSON.stringify(items)])

  const enrichedItems = (Array.isArray(enriched) && enriched.length > 0) ? enriched : (Array.isArray(items) ? items : [])

  // Fast price polling for real-time updates
  const symbols = useMemo(() => {
    return enrichedItems
      .filter((p: any) => (p.totalShares || 0) > 0)
      .map((p: any) => p.symbol?.toUpperCase())
      .filter(Boolean)
  }, [enrichedItems])

  const holdingsMap = useMemo(() => {
    return createHoldingsMap(enrichedItems)
  }, [enrichedItems])

  const priceMapRef = useRef<Map<string, number>>(new Map())
  const lastSnapshotRef = useRef<{ tpv: number; timestamp: number } | null>(null)
  const [liveTotals, setLiveTotals] = useState<{
    tpv: number
    costBasis: number
    totalReturn: number
    totalReturnPct: number
  } | null>(null)

  // Handle fast price updates
  const handlePriceUpdate = useCallback((updates: Array<{ symbol: string; price: number; timestamp: number }>) => {
    if (updates.length === 0) return

    // Update price map
    for (const update of updates) {
      priceMapRef.current.set(update.symbol.toUpperCase(), update.price)
    }

    // Calculate delta mark-to-market
    const walletBalance = data?.wallet?.balance || 0
    const result = calculateMarkToMarketDelta(
      holdingsMap,
      updates,
      priceMapRef.current,
      walletBalance,
      false // R3A: wallet excluded
    )

    // Update live totals
    setLiveTotals({
      tpv: result.tpv,
      costBasis: result.costBasis,
      totalReturn: result.totalReturn,
      totalReturnPct: result.totalReturnPct,
    })

    // Update SWR cache
    mutate({
      ...data,
      totals: {
        tpv: result.tpv,
        costBasis: result.costBasis,
        totalReturn: result.totalReturn,
        totalReturnPct: result.totalReturnPct,
      },
      items: result.holdings.map(h => ({
        symbol: h.symbol,
        totalShares: h.shares,
        avgPrice: h.avgPrice,
        currentPrice: h.currentPrice,
        totalValue: h.marketValue,
        unrealizedPnl: h.unrealizedPnl,
        unrealizedPnlPct: h.unrealizedPnlPct,
        totalCost: h.costBasis,
      })),
    }, { revalidate: false })

    // Rapid snapshot creation: save every 2 seconds OR if TPV changed by >0.01%
    // This ensures the graph updates rapidly with real portfolio value changes
    const now = Date.now()
    const shouldSave = !lastSnapshotRef.current || 
      (now - lastSnapshotRef.current.timestamp > 2000) || // 2 seconds passed (rapid updates)
      (Math.abs(result.tpv - lastSnapshotRef.current.tpv) / (lastSnapshotRef.current.tpv || 1) > 0.0001) // 0.01% change (more sensitive)

    if (shouldSave && userId) {
      lastSnapshotRef.current = { tpv: result.tpv, timestamp: now }
      
      // Save snapshot asynchronously (fire and forget)
      fetch('/api/portfolio/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tpv: result.tpv,
          costBasis: result.costBasis,
          totalReturn: result.totalReturn,
          totalReturnPct: result.totalReturnPct,
          holdings: result.holdings,
          walletBalance,
          lastUpdated: now
        })
      }).catch(err => console.error('Error saving snapshot:', err))
    }
  }, [holdingsMap, data, mutate, userId])

  // Start fast price polling after holdings are loaded
  useFastPricePolling({
    symbols,
    onUpdate: handlePriceUpdate,
    enabled: !!session?.user && symbols.length > 0 && Object.keys(holdingsMap).length > 0,
  })

  // Calculate portfolio metrics
  // Cost Basis = Net Deposits (from timeseries), not position cost basis
  // Use totals from API if available (mark-to-market), otherwise calculate from enriched items
  const metrics = useMemo(() => {
    // Prefer live totals from fast polling, then server-calculated totals, then fallback
    if (liveTotals) {
      return {
        totalValue: liveTotals.tpv || 0,
        totalCost: liveTotals.costBasis || 0,
        totalReturn: liveTotals.totalReturn || 0,
        totalReturnPercent: liveTotals.totalReturnPct || 0,
        holdingCount: Array.isArray(enrichedItems) ? enrichedItems.filter((p: any) => (p.totalShares || 0) > 0).length : 0,
        isPositive: (liveTotals.totalReturn || 0) >= 0
      }
    }
    // Prefer server-calculated totals (mark-to-market) if available
    if (data?.totals) {
      return {
        totalValue: data.totals.tpv || 0,
        totalCost: data.totals.costBasis || 0,
        totalReturn: data.totals.totalReturn || 0,
        totalReturnPercent: data.totals.totalReturnPct || 0,
        holdingCount: Array.isArray(enrichedItems) ? enrichedItems.filter((p: any) => (p.totalShares || 0) > 0).length : 0,
        isPositive: (data.totals.totalReturn || 0) >= 0
      }
    }

    // Fallback: calculate from enriched items
    let totalValue = 0
    let totalCost = 0
    let realizedPnl = 0
    let holdingCount = 0

    // Ensure enrichedItems is an array before iterating
    if (!Array.isArray(enrichedItems)) {
      return {
        totalValue: 0,
        totalCost: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
        holdingCount: 0,
        isPositive: true
      }
    }

    enrichedItems.forEach((p: any) => {
      if (p && typeof p === 'object' && (p.totalShares || 0) > 0) {
        holdingCount++
        // Current value (mark-to-market positions only)
        const value = p.totalValue || (p.currentPrice ? p.currentPrice * p.totalShares : 0)
        totalValue += value || 0
        
        // Realized P/L
        if (p.realizedPnl) {
          realizedPnl += p.realizedPnl || 0
        }
      }
    })

    // Cost Basis = sum of (avgPrice * totalShares) for all open positions
    enrichedItems.forEach((p: any) => {
      if (p && typeof p === 'object' && (p.totalShares || 0) > 0) {
        const cost = p.totalCost || (p.avgPrice ? p.avgPrice * p.totalShares : 0) || 0
        totalCost += cost
      }
    })

    // Total return = Portfolio Value - Cost Basis
    const totalReturn = totalValue - totalCost
    const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0

    return {
      totalValue: Number(totalValue.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      totalReturn: Number(totalReturn.toFixed(2)),
      totalReturnPercent: Number(totalReturnPercent.toFixed(2)),
      holdingCount,
      isPositive: totalReturn >= 0
    }
  }, [data?.totals, JSON.stringify(enrichedItems), timeseriesData])

  // Only show loading if we truly have no data (not just revalidating)
  if (isLoading && !data && enrichedItems.length === 0 && localItems.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-48 mb-4"></div>
          <div className="h-6 bg-slate-700 rounded w-32"></div>
        </div>
      </div>
    )
  }

  // Check if we have any positions (from API or localStorage)
  const hasPositions = (Array.isArray(enrichedItems) && enrichedItems.length > 0) || 
                       (data?.items && Array.isArray(data.items) && data.items.length > 0) || 
                       (Array.isArray(localItems) && localItems.length > 0)
  
  if (metrics.holdingCount === 0 && !hasPositions) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="text-white text-2xl font-bold mb-2">$0.00</div>
        <div className="text-slate-400 text-sm">No open positions</div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <div className="text-slate-400 text-sm">Total Portfolio Value</div>
            <MarketSessionBadge />
          </div>
          <div className="text-white text-4xl font-bold">${metrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        {metrics.totalReturn !== 0 && (
          <div className={`flex items-center gap-1 ${metrics.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {metrics.isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            <div className="text-lg font-semibold">
              {metrics.isPositive ? '+' : ''}{metrics.totalReturnPercent.toFixed(2)}%
            </div>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div>
          <div className="text-slate-400 text-xs mb-1">Cost Basis</div>
          <div className="text-white text-lg font-semibold">${metrics.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-slate-500 text-xs">Money invested</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs mb-1">Total Return</div>
          <div className={`text-lg font-semibold ${metrics.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {metrics.isPositive ? '+' : ''}${metrics.totalReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-slate-500 text-xs">Gain/Loss</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs mb-1">Return %</div>
          <div className={`text-lg font-semibold ${metrics.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {metrics.isPositive ? '+' : ''}{metrics.totalReturnPercent.toFixed(2)}%
          </div>
          <div className="text-slate-500 text-xs">Overall return</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs mb-1">Holdings</div>
          <div className="text-white text-lg font-semibold">{metrics.holdingCount}</div>
          <div className="text-slate-500 text-xs">Number of stocks</div>
        </div>
      </div>
    </div>
  )
}
