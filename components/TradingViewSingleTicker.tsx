'use client'

import { useEffect, useRef, memo } from 'react'

interface TradingViewSingleTickerProps {
  symbol: string
  width?: number
  height?: number
}

function TradingViewSingleTicker({ symbol, width = 350, height = 100 }: TradingViewSingleTickerProps) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string>(`tradingview-single-ticker-${symbol}-${Date.now()}`)

  useEffect(() => {
    if (!container.current) return

    // Clean up any existing scripts
    const existingScripts = container.current.querySelectorAll('script')
    existingScripts.forEach(script => script.remove())
    
    // Clear the widget container
    const widgetContainer = container.current.querySelector('.tradingview-widget-container__widget')
    if (widgetContainer) {
      widgetContainer.innerHTML = ''
    }

    // Create new script
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol: symbol.includes(':') ? symbol : `NASDAQ:${symbol}`,
      colorTheme: 'dark',
      isTransparent: false,
      locale: 'en',
      width: width,
      height: height
    })

    // Small delay to ensure cleanup completes
    setTimeout(() => {
      if (container.current) {
        container.current.appendChild(script)
      }
    }, 100)

    return () => {
      // Cleanup on unmount
      if (container.current) {
        const scripts = container.current.querySelectorAll('script')
        scripts.forEach(s => s.remove())
      }
    }
  }, [symbol, width, height])

  return (
    <div className="tradingview-widget-container" ref={container} style={{ width: `${width}px`, height: `${height}px` }}>
      <div className="tradingview-widget-container__widget"></div>
      <div className="tradingview-widget-copyright">
        <a 
          href={`https://www.tradingview.com/symbols/${symbol.includes(':') ? symbol.replace(':', '-') : `NASDAQ-${symbol}`}/`} 
          rel="noopener nofollow" 
          target="_blank"
          className="text-xs text-slate-500 hover:text-slate-400"
        >
          <span className="text-blue-400">{symbol} stock price</span>
        </a>
        <span className="text-slate-500 text-xs"> by TradingView</span>
      </div>
    </div>
  )
}

export default memo(TradingViewSingleTicker)

