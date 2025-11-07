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

    // Clear previous content
    container.current.innerHTML = ''

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

    container.current.appendChild(script)

    // Hide copyright elements that TradingView injects
    const hideCopyright = () => {
      if (container.current) {
        const copyrightElements = container.current.querySelectorAll('.tradingview-widget-copyright')
        copyrightElements.forEach((el) => {
          ;(el as HTMLElement).style.display = 'none'
        })
      }
    }

    // Hide copyright immediately and set up observer for dynamically added elements
    hideCopyright()
    const observer = new MutationObserver(hideCopyright)
    if (container.current) {
      observer.observe(container.current, { childList: true, subtree: true })
    }

    return () => {
      observer.disconnect()
    }
  }, [displayMode, feedMode, colorTheme, isTransparent, locale, symbol, width, height])

  return (
    <div className="tradingview-widget-container" ref={container}>
      <div className="tradingview-widget-container__widget"></div>
    </div>
  )
}

export default memo(TradingViewTopStories)

