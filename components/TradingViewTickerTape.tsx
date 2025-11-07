'use client'

import { useEffect, useRef, memo } from 'react'

function TradingViewTickerTape() {
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

    // Create new script
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbols: [
        {
          proName: 'NASDAQ:NVDA',
          title: 'Nvidia Corporation'
        },
        {
          proName: 'NASDAQ:MSFT',
          title: 'Microsoft Corporation'
        },
        {
          proName: 'NASDAQ:AAPL',
          title: 'Apple Inc.'
        },
        {
          proName: 'NASDAQ:AMZN',
          title: 'Amazon Inc.'
        },
        {
          proName: 'NASDAQ:GOOGL',
          title: 'Alphabet Inc.'
        }
      ],
      colorTheme: 'dark',
      locale: 'en',
      largeChartUrl: '',
      isTransparent: false,
      showSymbolLogo: true,
      displayMode: 'adaptive'
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
  }, [])

  return (
    <div className="tradingview-widget-container w-full" ref={container} style={{ height: '46px' }}>
      <div className="tradingview-widget-container__widget"></div>
      <div className="tradingview-widget-copyright" style={{ display: 'none' }}>
        <a 
          href="https://www.tradingview.com/markets/" 
          rel="noopener nofollow" 
          target="_blank"
          className="text-slate-500 hover:text-slate-400"
        >
          <span className="text-blue-400">Ticker tape</span>
        </a>
        <span className="text-slate-500"> by TradingView</span>
      </div>
    </div>
  )
}

export default memo(TradingViewTickerTape)

