'use client'

import { useEffect, useRef, memo } from 'react'
import { normalizeTradingViewSymbol } from '@/lib/tradingview'

interface TradingViewSingleTickerProps {
  symbol: string
  width?: number
  height?: number
}

function TradingViewSingleTicker({ symbol, width = 300, height = 80 }: TradingViewSingleTickerProps) {
  const container = useRef<HTMLDivElement>(null)

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

    // Normalize symbol using existing utility
    const { tvSymbol } = normalizeTradingViewSymbol(symbol)

    // Create new script
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol: tvSymbol,
      colorTheme: 'dark',
      isTransparent: false,
      locale: 'en',
      width: width,
      height: height
    })

    // Small delay to ensure cleanup completes
    const timeoutId = setTimeout(() => {
      if (container.current) {
        container.current.appendChild(script)
      }
    }, 150)

    return () => {
      clearTimeout(timeoutId)
      // Cleanup on unmount
      if (container.current) {
        const scripts = container.current.querySelectorAll('script')
        scripts.forEach(s => s.remove())
      }
    }
  }, [symbol, width, height])

  return (
    <div className="tradingview-widget-container" ref={container} style={{ width: `${width}px`, height: `${height}px`, minHeight: `${height}px` }}>
      <div className="tradingview-widget-container__widget"></div>
      <div className="tradingview-widget-copyright" style={{ fontSize: '10px', marginTop: '4px' }}>
        <a 
          href={`https://www.tradingview.com/symbols/${symbol.includes(':') ? symbol.replace(':', '-') : `NASDAQ-${symbol.toUpperCase()}`}/`} 
          rel="noopener nofollow" 
          target="_blank"
          className="text-slate-500 hover:text-slate-400"
        >
          <span className="text-blue-400">{symbol}</span>
        </a>
        <span className="text-slate-500"> by TradingView</span>
      </div>
    </div>
  )
}

export default memo(TradingViewSingleTicker)

