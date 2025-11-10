/**
 * Fast portfolio chart using Lightweight Charts (canvas-based)
 * Updates in real-time with delta price changes
 */

'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import useSWR from 'swr'
import { usePathname } from 'next/navigation'
import { safeJsonFetcher } from '@/lib/safeFetch'
import { getMarketSession } from '@/lib/marketSession'
import { useUserId, getUserStorageKey } from '@/hooks/useUserId'
import { authClient } from '@/lib/auth-client'
import { useFastPricePolling } from '@/hooks/useFastPricePolling'
import { createHoldingsMap, calculateMarkToMarketDelta, SnapshotThrottle } from '@/lib/portfolio-mark-to-market-fast'

// Dynamic import for lightweight-charts to ensure it only loads client-side
let chartsModule: any = null
const getChartsModule = async () => {
  if (chartsModule) {
    return chartsModule
  }
  try {
    // Try importing the module - it should work in browser
    chartsModule = await import('lightweight-charts')
    
    // Verify the exports
    if (!chartsModule.createChart) {
      console.error('createChart not found in module. Available:', Object.keys(chartsModule))
      throw new Error('createChart not exported from lightweight-charts')
    }
    
    return chartsModule
  } catch (error) {
    console.error('Error loading lightweight-charts:', error)
    throw error
  }
}

export function PortfolioChartFast() {
  const userId = useUserId()
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const seriesRef = useRef<any>(null)
  const lastTPVRef = useRef<number | null>(null)
  const priceMapRef = useRef<Map<string, number>>(new Map())
  const snapshotThrottleRef = useRef(new SnapshotThrottle())
  const pointsRef = useRef<Array<{ time: number; value: number }>>([])
  const rafPendingRef = useRef(false)
  const [chartInitialized, setChartInitialized] = useState(false)
  const [showFallback, setShowFallback] = useState(false)

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
    const newPoint = {
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

    let mounted = true
    let retryCount = 0
    const maxRetries = 20
    
    async function initializeChart() {
      if (!mounted || !chartContainerRef.current || chartRef.current) return
      
      const container = chartContainerRef.current
      let containerWidth = container.clientWidth || container.offsetWidth
      
      // Fallback to getBoundingClientRect if clientWidth is 0
      if (!containerWidth || containerWidth === 0) {
        const rect = container.getBoundingClientRect()
        containerWidth = rect.width
      }
      
      // Use a minimum width of 400 if still no width (fallback)
      if (!containerWidth || containerWidth === 0) {
        containerWidth = 800
      }
      
      // Ensure container has valid dimensions
      if (containerWidth < 100) {
        retryCount++
        if (retryCount < maxRetries) {
          // Retry after a short delay
          setTimeout(() => {
            if (mounted && chartContainerRef.current && !chartRef.current) {
              initializeChart()
            }
          }, 200)
        }
        return
      }

      try {
        // Load the charts module
        let module
        try {
          module = await getChartsModule()
          if (!module) {
            console.error('Failed to load lightweight-charts module - returned null/undefined')
            return
          }
        } catch (importError) {
          console.error('Failed to import lightweight-charts:', importError)
          return
        }

        // Try to get createChart and ColorType from module
        let createChart = module.createChart
        let ColorType = module.ColorType

        // If not found, try default export
        if (!createChart && module.default) {
          createChart = module.default.createChart
          ColorType = module.default.ColorType
        }

        // Verify createChart is available
        if (!createChart || typeof createChart !== 'function') {
          console.error('createChart is not a function. Module structure:', {
            keys: Object.keys(module),
            hasDefault: !!module.default,
            defaultKeys: module.default ? Object.keys(module.default) : []
          })
          return
        }

        if (!ColorType) {
          console.error('ColorType is not available in module')
          return
        }

        // Verify container is a valid DOM element
        if (!container || !(container instanceof HTMLElement)) {
          console.error('Container is not a valid HTMLElement', container)
          return
        }

        // Ensure container is visible and has dimensions
        if (containerWidth < 100 || container.offsetHeight < 100) {
          console.error('Container dimensions too small:', { width: containerWidth, height: container.offsetHeight })
          return
        }

        let chart
        try {
          chart = createChart(container, {
            layout: {
              background: { type: ColorType.Solid, color: '#1e293b' }, // slate-800
              textColor: '#94a3b8', // slate-400
            },
            grid: {
              vertLines: { color: '#334155' }, // slate-700
              horzLines: { color: '#334155' },
            },
            width: containerWidth,
            height: 400,
            timeScale: {
              timeVisible: true,
              secondsVisible: false,
            },
          })
        } catch (createError) {
          console.error('Error calling createChart:', createError)
          return
        }

        if (!chart) {
          console.error('Chart creation returned null/undefined')
          return
        }

        // Wait a tick to ensure chart is fully initialized
        await new Promise(resolve => setTimeout(resolve, 0))
        
        // Try to add line series - check if method exists
        if (typeof chart.addLineSeries !== 'function') {
          console.error('addLineSeries method not found on chart object')
          console.error('Chart type:', typeof chart)
          console.error('Chart keys:', Object.keys(chart))
          console.error('Chart prototype:', Object.getPrototypeOf(chart))
          console.error('Has addLineSeries in object:', 'addLineSeries' in chart)
          console.error('Has addLineSeries in prototype:', 'addLineSeries' in Object.getPrototypeOf(chart))
          
          // Try to access via any possible way
          const possibleMethods = ['addLineSeries', 'addSeries', 'createLineSeries']
          for (const methodName of possibleMethods) {
            if (typeof chart[methodName] === 'function') {
              console.log(`Found alternative method: ${methodName}`)
              try {
                const series = chart[methodName]({
                  color: '#10b981',
                  lineWidth: 2,
                  priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
                })
                chartRef.current = chart
                seriesRef.current = series
                setChartInitialized(true)
                return
              } catch (e) {
                console.error(`Error using ${methodName}:`, e)
              }
            }
          }
          
          if (chart && typeof chart.remove === 'function') {
            chart.remove()
          }
          return
        }

        // Add line series using the method we found (or use the one from direct call)
        if (!series && addLineSeriesMethod) {
          try {
            series = addLineSeriesMethod.call(chart, {
              color: '#10b981', // emerald-500
              lineWidth: 2,
              priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
              },
            })
          } catch (seriesError) {
            console.error('Error calling addLineSeries:', seriesError)
            if (chart && typeof chart.remove === 'function') {
              chart.remove()
            }
            return
          }
        }
        
        if (!series) {
          console.error('Failed to create series')
          if (chart && typeof chart.remove === 'function') {
            chart.remove()
          }
          return
        }

        if (!mounted) {
          chart.remove()
          return
        }

        chartRef.current = chart
        seriesRef.current = series
        setChartInitialized(true)

        // Load historical data
        const loadHistoricalData = async () => {
          try {
            const response = await fetch(`/api/portfolio/timeseries?range=1d&gran=5m`, {
              cache: 'no-store',
            })
            const data = await response.json()
            
            if (data?.series && Array.isArray(data.series) && seriesRef.current) {
              const historicalPoints: Array<{ time: number; value: number }> = data.series
                .map((p: any) => ({
                  time: Math.floor((p.t || Date.now()) / 1000),
                  value: p.portfolio || p.portfolioAbs || 0,
                }))
                .filter((p) => p.value > 0)
                .sort((a, b) => a.time - b.time)

              if (historicalPoints.length > 0 && seriesRef.current) {
                pointsRef.current = historicalPoints
                seriesRef.current.setData(historicalPoints)
              } else if (seriesRef.current) {
                // If no historical data, add a placeholder point
                const now = Math.floor(Date.now() / 1000)
                const placeholderValue = pf?.totals?.tpv || 0
                if (placeholderValue > 0) {
                  seriesRef.current.setData([{ time: now, value: placeholderValue }])
                }
              }
            } else if (seriesRef.current && pf?.totals?.tpv) {
              // Fallback: use current portfolio value if no historical data
              const now = Math.floor(Date.now() / 1000)
              seriesRef.current.setData([{ time: now, value: pf.totals.tpv }])
            }
          } catch (error) {
            console.error('Error loading historical data:', error)
            // Even if historical data fails, show current value
            if (seriesRef.current && pf?.totals?.tpv) {
              const now = Math.floor(Date.now() / 1000)
              seriesRef.current.setData([{ time: now, value: pf.totals.tpv }])
            }
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
        const width = chartContainerRef.current.clientWidth || chartContainerRef.current.offsetWidth || chartContainerRef.current.getBoundingClientRect().width
        if (width > 0) {
          chartRef.current.applyOptions({ width })
        }
      }
    }

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!mounted || !chartContainerRef.current || chartRef.current) return
        initializeChart()
      })
    })

    window.addEventListener('resize', handleResize)

    return () => {
      mounted = false
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
        setChartInitialized(false)
      }
    }
  }, [pf?.totals?.tpv])

  // Update chart when portfolio data changes
  useEffect(() => {
    if (!pf?.totals?.tpv || !seriesRef.current) return

    const tpv = pf.totals.tpv
    if (lastTPVRef.current !== tpv) {
      const now = Math.floor(Date.now() / 1000)
      const newPoint = { time: now, value: tpv }
      
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

  // Fallback: Show simple message if chart fails to load after timeout
  useEffect(() => {
    if (!session?.user) return
    const timer = setTimeout(() => {
      if (!chartInitialized) {
        setShowFallback(true)
      }
    }, 5000) // Show fallback after 5 seconds
    return () => clearTimeout(timer)
  }, [chartInitialized, session?.user])

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
      <div className="relative h-[400px] w-full">
        {!chartInitialized && !showFallback && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p>Loading chart...</p>
            </div>
          </div>
        )}
        {showFallback && !chartInitialized && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 z-10">
            <div className="text-center">
              <p className="mb-2">Chart unavailable</p>
              <p className="text-xs text-slate-500">Portfolio value: {lastTPVRef.current !== null ? `$${lastTPVRef.current.toLocaleString()}` : 'Loading...'}</p>
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="h-full w-full" style={{ minHeight: '400px' }} />
      </div>
    </div>
  )
}

