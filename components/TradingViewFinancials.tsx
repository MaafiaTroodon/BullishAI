'use client'

import { useEffect, useRef } from 'react'

interface TradingViewFinancialsProps {
  symbol: string
  exchange?: string
}

export function TradingViewFinancials({ symbol, exchange = 'NASDAQ' }: TradingViewFinancialsProps) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return

    const currentContainer = container.current
    currentContainer.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-financials.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol: `${exchange}:${symbol}`,
      colorTheme: 'dark',
      displayMode: 'regular',
      isTransparent: false,
      locale: 'en',
      width: 400,
      height: 550
    })
    
    currentContainer.appendChild(script)

    return () => {
      currentContainer.innerHTML = ''
    }
  }, [symbol, exchange])

  return (
    <div className="tradingview-widget-container h-[550px] w-full" ref={container}>
      <div className="tradingview-widget-container__widget"></div>
      <div className="tradingview-widget-copyright text-xs text-slate-500 mt-2">
        <a 
          href={`https://www.tradingview.com/symbols/${exchange}-${symbol}/financials-overview/`} 
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

