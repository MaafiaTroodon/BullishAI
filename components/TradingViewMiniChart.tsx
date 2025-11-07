'use client'

import { useEffect, useRef, memo, useState } from 'react'

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

  // Detect exchange if not provided
  const detectedExchange = exchange || EXCHANGE_MAP[symbol.toUpperCase()] || 'NASDAQ'

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
    if (!container.current || !isVisible || scriptLoaded.current) return

    // Clean up any existing script first
    const existingScript = container.current.querySelector('script')
    if (existingScript) {
      existingScript.remove()
    }

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js'
    script.type = 'text/javascript'
    script.async = true
    
    // Ensure valid settings - TradingView requires specific format
    const widgetConfig = {
      symbol: `${detectedExchange}:${symbol.toUpperCase()}`,
      chartOnly: false,
      dateRange: '12M',
      noTimeScale: false,
      colorTheme: 'dark' as const,
      isTransparent: false,
      locale: 'en',
      autosize: true
    }
    
    script.innerHTML = JSON.stringify(widgetConfig)
    script.setAttribute('data-symbol', symbol.toUpperCase())
    script.setAttribute('data-exchange', detectedExchange)

    container.current.appendChild(script)
    scriptLoaded.current = true

    return () => {
      if (container.current) {
        const scripts = container.current.querySelectorAll('script')
        scripts.forEach(s => s.remove())
        scriptLoaded.current = false
      }
    }
  }, [symbol, detectedExchange, isVisible])

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
