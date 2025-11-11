'use client'

import { useEffect, useRef } from 'react'

export function TradingViewHeatmap() {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return

    const currentContainer = container.current
    let isMounted = true
    
    // Clear previous content
    currentContainer.innerHTML = ''
    
    // Ensure widget container exists
    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    currentContainer.appendChild(widgetDiv)

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
    
    // Add error handler
    script.onerror = () => {
      if (isMounted) {
        console.error('TradingView heatmap widget failed to load')
      }
    }
    
    // Small delay to ensure widget container is ready
    const timeoutId = setTimeout(() => {
      if (isMounted && currentContainer && widgetDiv) {
        try {
          widgetDiv.appendChild(script)
        } catch (error) {
          console.error('Error appending TradingView heatmap script:', error)
        }
      }
    }, 100)

    // Hide copyright elements that TradingView injects
    const hideCopyright = () => {
      if (!isMounted || !currentContainer) return
      try {
        const widgetContainer = currentContainer.querySelector('.tradingview-widget-container__widget')
        if (!widgetContainer) return
        const copyrightElements = widgetContainer.querySelectorAll('.tradingview-widget-copyright')
        copyrightElements.forEach((el) => {
          if (el && el instanceof HTMLElement) {
            el.style.display = 'none'
          }
        })
      } catch (err) {
        // Silently ignore querySelector errors
      }
    }

    // Hide copyright immediately and set up observer for dynamically added elements
    hideCopyright()
    const observer = new MutationObserver(hideCopyright)
    if (currentContainer) {
      observer.observe(currentContainer, { childList: true, subtree: true })
    }

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
      observer.disconnect()
      if (currentContainer) {
        try {
          currentContainer.innerHTML = ''
        } catch (err) {
          // Ignore cleanup errors
        }
      }
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

