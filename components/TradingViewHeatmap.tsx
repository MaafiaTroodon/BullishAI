'use client'

import { useEffect, useRef, useState } from 'react'

export function TradingViewHeatmap() {
  const container = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!container.current) return

    const currentContainer = container.current
    currentContainer.innerHTML = ''
    setIsLoading(true)

    // Create wrapper div
    const wrapper = document.createElement('div')
    wrapper.className = 'tradingview-widget-container__widget'
    wrapper.style.height = '600px'
    wrapper.style.width = '100%'
    
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
      height: 600
    })
    
    wrapper.appendChild(script)
    currentContainer.appendChild(wrapper)

    const handleLoad = () => setIsLoading(false)
    script.onload = handleLoad
    setTimeout(() => setIsLoading(false), 2000) // Fallback timeout

    return () => {
      try {
        if (currentContainer && currentContainer.firstChild) {
          currentContainer.removeChild(currentContainer.firstChild)
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      currentContainer.innerHTML = ''
    }
  }, [])

  return (
    <div className="w-full">
      <div className="tradingview-widget-container w-full h-[600px] bg-slate-800 rounded-lg overflow-hidden relative" ref={container}>
        <div className="tradingview-widget-container__widget" style={{ minHeight: '600px', width: '100%' }}></div>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
            <div className="text-slate-400">Loading heatmap...</div>
          </div>
        )}
      </div>
      <div className="tradingview-widget-copyright text-xs text-slate-500 mt-2 text-center">
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

