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
    currentContainer.innerHTML = ''
    setError(false)

    const n = normalizeTradingViewSymbol(symbol)

    // Set a timeout to detect if widget fails to load
    const timeout = setTimeout(() => {
      if (currentContainer.innerHTML.trim() === '' || !currentContainer.querySelector('.tradingview-widget-container__widget iframe')) {
        setError(true)
      }
    }, 5000)

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
      setError(true)
      clearTimeout(timeout)
    }
    
    currentContainer.appendChild(script)

    return () => {
      clearTimeout(timeout)
      currentContainer.innerHTML = ''
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

  return (
    <div className="tradingview-widget-container h-[550px] w-full" ref={container}>
      <div className="tradingview-widget-container__widget w-full h-full"></div>
      <div className="tradingview-widget-copyright text-xs text-slate-500 mt-2">
        <a 
          href={`https://www.tradingview.com/symbols/${normalizeTradingViewSymbol(symbol).tvSymbol.replace(':','-')}/financials-overview/`} 
          rel="noopener nofollow" 
          target="_blank"
          className="text-blue-500 hover:text-blue-400"
        >
          {symbol} fundamentals
        </a>{' '}
        <span> by TradingView</span>
      </div>
    </div>
  )
}

