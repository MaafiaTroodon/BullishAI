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
      height: 600
    })
    
    currentContainer.appendChild(script)

    // Hide copyright elements that TradingView injects
    const hideCopyright = () => {
      if (currentContainer) {
        const copyrightElements = currentContainer.querySelectorAll('.tradingview-widget-copyright')
        copyrightElements.forEach((el) => {
          ;(el as HTMLElement).style.display = 'none'
        })
      }
    }

    // Hide copyright immediately and set up observer for dynamically added elements
    hideCopyright()
    const observer = new MutationObserver(hideCopyright)
    if (currentContainer) {
      observer.observe(currentContainer, { childList: true, subtree: true })
    }

    return () => {
      observer.disconnect()
      currentContainer.innerHTML = ''
    }
  }, [])

  return (
    <div className="w-full">
      <div className="tradingview-widget-container w-full" ref={container}>
        <div className="tradingview-widget-container__widget"></div>
      </div>
    </div>
  )
}

