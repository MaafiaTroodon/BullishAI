'use client'

import { useEffect, useRef, useState } from 'react'
import { normalizeTradingViewSymbol } from '@/lib/tradingview'

interface TradingViewFinancialsProps {
  symbol: string
  exchange?: string
}

export function TradingViewFinancials({ symbol, exchange = 'NASDAQ' }: TradingViewFinancialsProps) {
  const container = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!container.current) return

    const currentContainer = container.current
    let isMounted = true
    setError(false)

    // Suppress TradingView iframe console errors (they're harmless CORS warnings)
    const originalConsoleError = console.error
    const suppressTradingViewErrors = (...args: any[]) => {
      const msg = args.join(' ')
      if (msg.includes('contentWindow') || msg.includes('iframe') || msg.includes('TradingView')) {
        // Suppress these harmless warnings
        return
      }
      originalConsoleError.apply(console, args)
    }
    console.error = suppressTradingViewErrors

    // Clear previous content safely using innerHTML (safer than removeChild)
    if (currentContainer) {
      currentContainer.innerHTML = ''
    }

    const n = normalizeTradingViewSymbol(symbol)

    // Set a timeout to detect if widget fails to load
    const timeout = setTimeout(() => {
      if (isMounted && currentContainer && (!currentContainer.querySelector('.tradingview-widget-container__widget iframe'))) {
        setError(true)
      }
    }, 5000)

    // Create a wrapper div for the widget
    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-financials.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol: n.tvSymbol,
      colorTheme: 'dark',
      displayMode: 'regular',
      isTransparent: false,
      locale: 'en',
      width: '100%',
      height: 550
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
      // Restore original console.error
      console.error = originalConsoleError
      // Use innerHTML for safer cleanup - avoids removeChild errors
      if (currentContainer) {
        try {
          currentContainer.innerHTML = ''
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    }
  }, [symbol, exchange])

  if (error) {
    return (
      <div className="h-[550px] w-full flex items-center justify-center text-slate-400">
        <div className="text-center">
          <p className="mb-2">Financial data not available for {symbol}</p>
          <p className="text-sm text-slate-500">Some symbols may not have financial data on TradingView</p>
          <a 
            href={`https://www.tradingview.com/symbols/${normalizeTradingViewSymbol(symbol).tvSymbol.replace(':','-')}/financials-overview/`} 
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

  const tvSymbol = normalizeTradingViewSymbol(symbol).tvSymbol

  return (
    <div className="w-full">
      <div className="tradingview-widget-container h-[550px] w-full overflow-hidden" ref={container}>
        {/* Widget will be inserted here by script */}
      </div>
      <div className="tradingview-widget-copyright text-xs text-slate-500 mt-2">
        <div className="text-slate-400 mb-1">Symbol: {symbol} ({tvSymbol})</div>
        <a 
          href={`https://www.tradingview.com/symbols/${tvSymbol.replace(':','-')}/financials-overview/`} 
          rel="noopener nofollow" 
          target="_blank"
          className="text-blue-500 hover:text-blue-400"
        >
          View {symbol} fundamentals on TradingView →
        </a>
      </div>
    </div>
  )
}

