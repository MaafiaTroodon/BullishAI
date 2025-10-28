'use client'

import { useEffect, useRef } from 'react'

export function TradingViewHeatmap() {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return

    const currentContainer = container.current
    currentContainer.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      dataSource: 'SPX500',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      grouping: 'sector',
      locale: 'en',
      symbolUrl: '',
      colorTheme: 'dark',
      exchanges: [],
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%'
    })
    
    currentContainer.appendChild(script)

    return () => {
      currentContainer.innerHTML = ''
    }
  }, [])

  return (
    <div className="tradingview-widget-container h-[600px] w-full" ref={container}>
      <div className="tradingview-widget-container__widget"></div>
      <div className="tradingview-widget-copyright text-xs text-slate-500 mt-2">
        <a 
          href="https://www.tradingview.com/heatmap/stock/" 
          rel="noopener nofollow" 
          target="_blank"
          className="text-blue-500 hover:text-blue-400"
        >
          Stock Heatmap
        </a>{' '}
        <span> by TradingView</span>
      </div>
    </div>
  )
}

