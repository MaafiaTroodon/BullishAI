'use client'

import { useEffect, useRef, memo, useState } from 'react'
import { normalizeTradingViewSymbol } from '@/lib/tradingview'

interface TradingViewMiniChartProps {
  symbol: string
  exchange?: string
  width?: string
  height?: string
}

// Common exchange mappings
const EXCHANGE_MAP: Record<string, string> = {
  'AAPL': 'NASDAQ',
  'MSFT': 'NASDAQ',
  'GOOGL': 'NASDAQ',
  'GOOG': 'NASDAQ',
  'AMZN': 'NASDAQ',
  'TSLA': 'NASDAQ',
  'META': 'NASDAQ',
  'NVDA': 'NASDAQ',
  'NFLX': 'NASDAQ',
  'AMD': 'NASDAQ',
  'INTC': 'NASDAQ',
  'JPM': 'NYSE',
  'BAC': 'NYSE',
  'WMT': 'NYSE',
  'V': 'NYSE',
  'MA': 'NYSE',
  'DIS': 'NYSE',
  'PG': 'NYSE',
  'JNJ': 'NYSE',
  'XOM': 'NYSE',
  'CVX': 'NYSE'
}

function TradingViewMiniChart({ symbol, exchange, width = '100%', height = '100%' }: TradingViewMiniChartProps) {
  const container = useRef<HTMLDivElement>(null)
  const scriptLoaded = useRef(false)
  const [isVisible, setIsVisible] = useState(false)
  const [currentSymbol, setCurrentSymbol] = useState(symbol)

  // Normalize symbol using centralized function
  const { exchange: detectedExchange, tvSymbol: normalizedSymbol } = normalizeTradingViewSymbol(symbol)

  // Update current symbol when prop changes
  useEffect(() => {
    if (symbol !== currentSymbol) {
      setCurrentSymbol(symbol)
      scriptLoaded.current = false
    }
  }, [symbol, currentSymbol])

  // Lazy load with IntersectionObserver
  useEffect(() => {
    if (!container.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.1 }
    )

    observer.observe(container.current)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!container.current || !isVisible) return

    // Always clean up existing scripts when symbol changes
    const existingScripts = container.current.querySelectorAll('script')
    existingScripts.forEach(s => s.remove())
    const existingWidget = container.current.querySelector('.tradingview-widget-container__widget')
    if (existingWidget) {
      existingWidget.innerHTML = ''
    }
    scriptLoaded.current = false

    // Small delay to ensure cleanup is complete
    const timeoutId = setTimeout(() => {
      if (!container.current || !currentSymbol) return

      const script = document.createElement('script')
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js'
      script.type = 'text/javascript'
      script.async = true
      
      // Ensure valid settings - TradingView requires specific format
      // Use 1D range to show daily performance (reflects actual stock movement)
      const { tvSymbol } = normalizeTradingViewSymbol(currentSymbol)
      const widgetConfig = {
        symbol: tvSymbol,
        chartOnly: false,
        dateRange: '1D', // Changed from 12M to 1D to show daily performance
        noTimeScale: false,
        colorTheme: 'dark' as const,
        isTransparent: false,
        locale: 'en',
        autosize: true
      }
      
      script.innerHTML = JSON.stringify(widgetConfig)
      script.setAttribute('data-symbol', currentSymbol.toUpperCase())
      script.setAttribute('data-exchange', detectedExchange)

      container.current.appendChild(script)
      scriptLoaded.current = true
    }, 150)

    // Hide copyright elements that TradingView injects
    const hideCopyright = () => {
      if (container.current) {
        const copyrightElements = container.current.querySelectorAll('.tradingview-widget-copyright')
        copyrightElements.forEach((el) => {
          ;(el as HTMLElement).style.display = 'none'
        })
      }
    }

    // Hide copyright immediately and set up observer for dynamically added elements
    hideCopyright()
    const observer = new MutationObserver(hideCopyright)
    if (container.current) {
      observer.observe(container.current, { childList: true, subtree: true })
    }

    return () => {
      clearTimeout(timeoutId)
      observer.disconnect()
      if (container.current) {
        const scripts = container.current.querySelectorAll('script')
        scripts.forEach(s => s.remove())
        scriptLoaded.current = false
      }
    }
  }, [currentSymbol, detectedExchange, isVisible])

  return (
    <div 
      className="tradingview-widget-container" 
      ref={container} 
      style={{ width, height, minHeight: '40px' }}
      aria-label={`${symbol} price chart`}
    >
      {!isVisible && (
        <div className="flex items-center justify-center h-full text-slate-500 text-xs">Loading...</div>
      )}
      <div className="tradingview-widget-container__widget"></div>
    </div>
  )
}

export default memo(TradingViewMiniChart)
