/**
 * Fast price polling hook for real-time mark-to-market updates
 * Polls every 5-10s during market hours, batches symbols, dedupes
 */

import { useEffect, useRef, useCallback } from 'react'
import useSWR from 'swr'
import { getMarketSession } from '@/lib/marketSession'

interface PriceUpdate {
  symbol: string
  price: number
  timestamp: number
}

interface UseFastPricePollingOptions {
  symbols: string[]
  onUpdate?: (updates: PriceUpdate[]) => void
  enabled?: boolean
}

const PRICE_CACHE = new Map<string, { price: number; timestamp: number }>()

/**
 * Fast price polling hook
 * Polls every 5-10s during market hours, 30s when closed
 */
export function useFastPricePolling({ symbols, onUpdate, enabled = true }: UseFastPricePollingOptions) {
  const updateCallbackRef = useRef(onUpdate)
  const lastUpdateRef = useRef<Map<string, number>>(new Map())
  const rafIdRef = useRef<number | null>(null)

  // Update callback ref when it changes
  useEffect(() => {
    updateCallbackRef.current = onUpdate
  }, [onUpdate])

  // Dedupe symbols
  const uniqueSymbols = Array.from(new Set(symbols.filter(Boolean)))
  
  // Determine polling interval based on market session
  const marketSession = typeof window !== 'undefined' ? getMarketSession() : { session: 'CLOSED' as const }
  const isMarketOpen = marketSession.session === 'REG' || marketSession.session === 'PRE' || marketSession.session === 'POST'
  const pollInterval = isMarketOpen ? 5000 : 30000 // 5s during market, 30s when closed

  // Fetch prices for all symbols in parallel
  const fetchPrices = useCallback(async () => {
    if (!enabled || uniqueSymbols.length === 0) return

    try {
      // Batch fetch all symbols at once
      const symbolsParam = uniqueSymbols.join(',')
      const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbolsParam)}`, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) return

      const data = await response.json()
      const updates: PriceUpdate[] = []
      const now = Date.now()

      // Process each quote
      if (Array.isArray(data)) {
        for (const item of data) {
          if (!item?.symbol || !item?.data?.price) continue
          
          const symbol = item.symbol.toUpperCase()
          const price = item.data.price
          const lastPrice = lastUpdateRef.current.get(symbol)
          
          // Only emit if price changed (delta update)
          if (lastPrice !== price) {
            lastUpdateRef.current.set(symbol, price)
            PRICE_CACHE.set(symbol, { price, timestamp: now })
            updates.push({ symbol, price, timestamp: now })
          }
        }
      }

      // Emit updates if any prices changed
      if (updates.length > 0 && updateCallbackRef.current) {
        // Use requestAnimationFrame for smooth updates
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
        }
        rafIdRef.current = requestAnimationFrame(() => {
          updateCallbackRef.current?.(updates)
        })
      }
    } catch (error) {
      console.error('Fast price polling error:', error)
    }
  }, [uniqueSymbols, enabled])

  // Set up polling
  useEffect(() => {
    if (!enabled || uniqueSymbols.length === 0) return

    // Initial fetch
    fetchPrices()

    // Set up interval
    const intervalId = setInterval(fetchPrices, pollInterval)

    return () => {
      clearInterval(intervalId)
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [fetchPrices, pollInterval, enabled, uniqueSymbols.length])

  // Return cached prices for immediate access
  return {
    getCachedPrice: (symbol: string): number | null => {
      const cached = PRICE_CACHE.get(symbol.toUpperCase())
      return cached?.price ?? null
    },
    clearCache: () => {
      PRICE_CACHE.clear()
      lastUpdateRef.current.clear()
    }
  }
}

