'use client'

import { useEffect, useRef } from 'react'
import { normalizeTradingViewSymbol } from '@/lib/tradingview'

interface TradingViewTechnicalAnalysisProps {
  symbol: string
  exchange?: string
}

export function TradingViewTechnicalAnalysis({ symbol, exchange = 'NASDAQ' }: TradingViewTechnicalAnalysisProps) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return

    // Clear previous content
    const currentContainer = container.current
    currentContainer.innerHTML = ''

    const n = normalizeTradingViewSymbol(symbol)

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
      width: 425,
      height: 450,
      symbol: n.tvSymbol,
      showIntervalTabs: true
    })
    
    currentContainer.appendChild(script)

    return () => {
      // Cleanup on unmount
      currentContainer.innerHTML = ''
    }
  }, [symbol, exchange])

  return (
    <div className="tradingview-widget-container h-[450px] w-full" ref={container}>
      <div className="tradingview-widget-container__widget"></div>
      <div className="tradingview-widget-copyright text-xs text-slate-500 mt-2">
        <a 
          href={`https://www.tradingview.com/symbols/${normalizeTradingViewSymbol(symbol).tvSymbol.replace(':','-')}/technicals/`} 
          rel="noopener nofollow" 
          target="_blank"
          className="text-blue-500 hover:text-blue-400"
        >
          {symbol} technical analysis
        </a>{' '}
        <span> by TradingView</span>
      </div>
    </div>
  )
}

