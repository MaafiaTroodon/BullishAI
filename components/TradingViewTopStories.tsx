'use client'

import { useEffect, useRef, memo } from 'react'

interface TradingViewTopStoriesProps {
  displayMode?: 'regular' | 'compact'
  feedMode?: 'all_symbols' | 'watchlist' | 'symbol'
  colorTheme?: 'light' | 'dark'
  isTransparent?: boolean
  locale?: string
  width?: string | number
  height?: string | number
  symbol?: string
}

function TradingViewTopStories({
  displayMode = 'regular',
  feedMode = 'all_symbols',
  colorTheme = 'dark',
  isTransparent = false,
  locale = 'en',
  width = '100%',
  height = '100%',
  symbol,
}: TradingViewTopStoriesProps) {
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
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-timeline.js'
    script.type = 'text/javascript'
    script.async = true
    
    const config: any = {
      displayMode,
      feedMode,
      colorTheme,
      isTransparent,
      locale,
      width,
      height,
    }

    if (symbol) {
      config.symbol = symbol
    }

    script.innerHTML = JSON.stringify(config)
    
    // Add error handler
    script.onerror = () => {
      if (isMounted) {
        console.error('TradingView timeline widget failed to load')
      }
    }

    // Small delay to ensure widget container is ready
    const timeoutId = setTimeout(() => {
      if (isMounted && currentContainer && widgetDiv) {
        try {
          widgetDiv.appendChild(script)
        } catch (error) {
          console.error('Error appending TradingView timeline script:', error)
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
  }, [displayMode, feedMode, colorTheme, isTransparent, locale, symbol, width, height])

  return (
    <div className="tradingview-widget-container" ref={container}>
      <div className="tradingview-widget-container__widget"></div>
    </div>
  )
}

export default memo(TradingViewTopStories)

