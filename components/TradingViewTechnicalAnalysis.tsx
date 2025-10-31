'use client'

import { useEffect, useRef, useState } from 'react'
import { normalizeTradingViewSymbol } from '@/lib/tradingview'

interface TradingViewTechnicalAnalysisProps {
  symbol: string
  exchange?: string
  width?: number
  height?: number
}

export function TradingViewTechnicalAnalysis({ symbol, exchange = 'NASDAQ', width = 360, height = 360 }: TradingViewTechnicalAnalysisProps) {
  const container = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!container.current) return

    const currentContainer = container.current
    let isMounted = true
    setError(false)

    // Clear previous content safely using innerHTML (safer than removeChild)
    if (currentContainer) {
      currentContainer.innerHTML = ''
    }

    const n = normalizeTradingViewSymbol(symbol)

    // Set timeout to detect loading failure
    const timeout = setTimeout(() => {
      if (isMounted && currentContainer && (!currentContainer.querySelector('.tradingview-widget-container__widget iframe'))) {
        setError(true)
      }
    }, 5000)

    // Create a wrapper div for the widget
    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      colorTheme: 'dark',
      displayMode: 'single',
      isTransparent: false,
      locale: 'en',
      interval: '1m',
      disableInterval: false,
      width: '100%',
      height: height,
      symbol: n.tvSymbol,
      showIntervalTabs: true
    })
    
    script.onerror = () => {
      if (isMounted) {
        setError(true)
        clearTimeout(timeout)
      }
    }
    
    if (currentContainer && isMounted) {
      currentContainer.appendChild(widgetDiv)
      widgetDiv.appendChild(script)
    }

    return () => {
      isMounted = false
      clearTimeout(timeout)
      // Use innerHTML for safer cleanup - avoids removeChild errors
      if (currentContainer) {
        try {
          currentContainer.innerHTML = ''
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    }
  }, [symbol, exchange, height])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400" style={{minHeight: `${height}px`}}>
        <div className="text-center">
          <p className="mb-2">Technical analysis not available for {symbol}</p>
          <p className="text-sm text-slate-500">Some symbols may not be supported</p>
          <a 
            href={`https://www.tradingview.com/symbols/${normalizeTradingViewSymbol(symbol).tvSymbol.replace(':','-')}/technicals/`} 
            rel="noopener nofollow" 
            target="_blank"
            className="text-blue-500 hover:text-blue-400 text-sm mt-2 inline-block"
          >
            Check on TradingView →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="tradingview-widget-container flex-1 min-h-0 overflow-hidden" style={{minHeight: `${height}px`, width: '100%'}} ref={container}>
        {/* Widget will be inserted here by script */}
      </div>
      <div className="tradingview-widget-copyright text-xs text-slate-500 mt-2">
        <div className="text-slate-400 mb-1">Symbol: {symbol} ({normalizeTradingViewSymbol(symbol).tvSymbol})</div>
        <a 
          href={`https://www.tradingview.com/symbols/${normalizeTradingViewSymbol(symbol).tvSymbol.replace(':','-')}/technicals/`} 
          rel="noopener nofollow" 
          target="_blank"
          className="text-blue-500 hover:text-blue-400"
        >
          View {symbol} technical analysis on TradingView →
        </a>
      </div>
    </div>
  )
}

