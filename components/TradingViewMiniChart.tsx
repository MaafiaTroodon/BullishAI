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

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol: `${detectedExchange}:${symbol.toUpperCase()}`,
      chartOnly: false,
      dateRange: '12M',
      noTimeScale: false,
      colorTheme: 'dark',
      isTransparent: false,
      locale: 'en',
      width: width,
      autosize: true,
      height: height
    })

    container.current.appendChild(script)
    scriptLoaded.current = true

    return () => {
      if (container.current && script.parentNode) {
        script.parentNode.removeChild(script)
        scriptLoaded.current = false
      }
    }
  }, [symbol, detectedExchange, width, height, isVisible])

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
