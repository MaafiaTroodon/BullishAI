/**
 * Fast portfolio chart using Lightweight Charts (canvas-based)
 * Updates in real-time with delta price changes
 */

'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { createChart, ColorType, IChartApi, ISeriesApi, LineData } from 'lightweight-charts'
import useSWR from 'swr'
import { usePathname } from 'next/navigation'
import { safeJsonFetcher } from '@/lib/safeFetch'
import { getMarketSession } from '@/lib/marketSession'
import { useUserId, getUserStorageKey } from '@/hooks/useUserId'
import { authClient } from '@/lib/auth-client'
import { useFastPricePolling } from '@/hooks/useFastPricePolling'
import { createHoldingsMap, calculateMarkToMarketDelta, SnapshotThrottle } from '@/lib/portfolio-mark-to-market-fast'

export function PortfolioChartFast() {
  const userId = useUserId()
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const lastTPVRef = useRef<number | null>(null)
  const priceMapRef = useRef<Map<string, number>>(new Map())
  const snapshotThrottleRef = useRef(new SnapshotThrottle())
  const pointsRef = useRef<LineData[]>([])
  const rafPendingRef = useRef(false)

  // Fetch portfolio data
  const { data: pf } = useSWR(
    session?.user ? '/api/portfolio?enrich=1' : null,
    safeJsonFetcher,
    { 
      refreshInterval: 0, // We'll use fast polling instead
      revalidateIfStale: true,
    }
  )

  // Extract symbols from holdings
  const symbols = useMemo(() => {
    if (!pf?.items || !Array.isArray(pf.items)) return []
    return pf.items
      .filter((p: any) => (p.totalShares || 0) > 0)
      .map((p: any) => p.symbol?.toUpperCase())
      .filter(Boolean)
  }, [pf?.items])

  // Create holdings map (memoized)
  const holdingsMap = useMemo(() => {
    if (!pf?.items || !Array.isArray(pf.items)) return {}
    return createHoldingsMap(pf.items)
  }, [pf?.items])

  // Fast price polling with delta updates
  const handlePriceUpdate = useCallback((updates: Array<{ symbol: string; price: number; timestamp: number }>) => {
    if (updates.length === 0 || !chartRef.current || !seriesRef.current) return

    // Update price map
    for (const update of updates) {
      priceMapRef.current.set(update.symbol.toUpperCase(), update.price)
    }

    // Calculate delta mark-to-market
    const walletBalance = pf?.wallet?.balance || 0
    const result = calculateMarkToMarketDelta(
      holdingsMap,
      updates,
      priceMapRef.current,
      walletBalance,
      false // R3A: wallet excluded
    )

    // Update chart with new TPV point
    const now = Date.now()
    const newPoint: LineData = {
      time: Math.floor(now / 1000), // Lightweight Charts uses Unix timestamp in seconds
      value: result.tpv,
    }

    // Coalesce: if multiple ticks in same second, keep latest
    if (pointsRef.current.length > 0) {
      const lastPoint = pointsRef.current[pointsRef.current.length - 1]
      if (lastPoint.time === newPoint.time) {
        // Replace last point
        pointsRef.current[pointsRef.current.length - 1] = newPoint
      } else {
        // Append new point
        pointsRef.current.push(newPoint)
      }
    } else {
      pointsRef.current.push(newPoint)
    }

    // Limit points for performance (keep last 1000)
    if (pointsRef.current.length > 1000) {
      pointsRef.current = pointsRef.current.slice(-1000)
    }

    // Update chart using requestAnimationFrame
    if (!rafPendingRef.current) {
      rafPendingRef.current = true
      requestAnimationFrame(() => {
        if (seriesRef.current && pointsRef.current.length > 0) {
          const latestPoint = pointsRef.current[pointsRef.current.length - 1]
          seriesRef.current.update(latestPoint)
        }
        rafPendingRef.current = false
      })
    }

    // Throttled DB save (non-blocking) - call API endpoint instead of direct DB access
    if (snapshotThrottleRef.current.shouldSave(result.tpv)) {
      // Save snapshot via API (server-side only)
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
          lastUpdated: now,
        }),
      }).catch(err => {
        console.error('Error saving snapshot:', err)
      })
    }

    lastTPVRef.current = result.tpv
  }, [holdingsMap, pf?.wallet?.balance, userId])

  // Fast price polling
  useFastPricePolling({
    symbols,
    onUpdate: handlePriceUpdate,
    enabled: !!session?.user && symbols.length > 0,
  })

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return

    const container = chartContainerRef.current
    
    function initializeChart() {
      if (!chartContainerRef.current || chartRef.current) return
      
      try {
        const chart = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: '#1e293b' }, // slate-800
            textColor: '#94a3b8', // slate-400
          },
          grid: {
            vertLines: { color: '#334155' }, // slate-700
            horzLines: { color: '#334155' },
          },
          width: chartContainerRef.current.clientWidth || chartContainerRef.current.offsetWidth || 800,
          height: 400,
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
          },
        })

        if (!chart || typeof chart.addLineSeries !== 'function') {
          console.error('Chart initialization failed: addLineSeries not available', chart)
          return
        }

        const series = chart.addLineSeries({
          color: '#10b981', // emerald-500
          lineWidth: 2,
          priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
          },
        })

        chartRef.current = chart
        seriesRef.current = series

        // Load historical data
        const loadHistoricalData = async () => {
          try {
            const response = await fetch(`/api/portfolio/timeseries?range=1d&gran=5m`, {
              cache: 'no-store',
            })
            const data = await response.json()
            
            if (data?.series && Array.isArray(data.series)) {
              const historicalPoints: LineData[] = data.series
                .map((p: any) => ({
                  time: Math.floor((p.t || Date.now()) / 1000),
                  value: p.portfolio || p.portfolioAbs || 0,
                }))
                .filter((p: LineData) => p.value > 0)
                .sort((a: LineData, b: LineData) => (a.time as number) - (b.time as number))

              if (historicalPoints.length > 0) {
                pointsRef.current = historicalPoints
                series.setData(historicalPoints)
              }
            }
          } catch (error) {
            console.error('Error loading historical data:', error)
          }
        }

        loadHistoricalData()
      } catch (error) {
        console.error('Error initializing chart:', error)
      }
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth || chartContainerRef.current.offsetWidth || 800,
        })
      }
    }

    // Call initializeChart if container is ready
    if (containerWidth > 0) {
      initializeChart()
      window.addEventListener('resize', handleResize)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
      }
    }
  }, [])

  // Update chart when portfolio data changes
  useEffect(() => {
    if (!pf?.totals?.tpv || !seriesRef.current) return

    const tpv = pf.totals.tpv
    if (lastTPVRef.current !== tpv) {
      const now = Math.floor(Date.now() / 1000)
      const newPoint: LineData = { time: now, value: tpv }
      
      // Coalesce
      if (pointsRef.current.length > 0) {
        const lastPoint = pointsRef.current[pointsRef.current.length - 1]
        if (lastPoint.time === newPoint.time) {
          pointsRef.current[pointsRef.current.length - 1] = newPoint
        } else {
          pointsRef.current.push(newPoint)
        }
      } else {
        pointsRef.current.push(newPoint)
      }

      if (!rafPendingRef.current) {
        rafPendingRef.current = true
        requestAnimationFrame(() => {
          if (seriesRef.current) {
            seriesRef.current.update(newPoint)
          }
          rafPendingRef.current = false
        })
      }

      lastTPVRef.current = tpv
    }
  }, [pf?.totals?.tpv])

  if (!session?.user) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="h-[400px] flex items-center justify-center text-slate-400">
          Please sign in to view your portfolio chart
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Portfolio Value</h3>
        <div className="text-sm text-slate-400">
          {lastTPVRef.current !== null 
            ? `$${lastTPVRef.current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : 'Loading...'}
        </div>
      </div>
      <div ref={chartContainerRef} className="h-[400px] w-full" />
    </div>
  )
}

