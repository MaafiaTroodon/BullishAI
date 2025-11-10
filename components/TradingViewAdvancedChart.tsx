'use client'

import { useEffect, useRef, memo } from 'react'

interface TradingViewAdvancedChartProps {
  symbol: string
  allowSymbolChange?: boolean
  calendar?: boolean
  details?: boolean
  hideSideToolbar?: boolean
  hideTopToolbar?: boolean
  hideLegend?: boolean
  hideVolume?: boolean
  hotlist?: boolean
  interval?: string
  locale?: string
  saveImage?: boolean
  style?: string
  theme?: 'light' | 'dark'
  timezone?: string
  backgroundColor?: string
  gridColor?: string
  width?: string
  height?: string
  autosize?: boolean
}

function TradingViewAdvancedChart({
  symbol,
  allowSymbolChange = true,
  calendar = false,
  details = false,
  hideSideToolbar = true,
  hideTopToolbar = false,
  hideLegend = false,
  hideVolume = false,
  hotlist = false,
  interval = 'D',
  locale = 'en',
  saveImage = true,
  style = '1',
  theme = 'dark',
  timezone = 'Etc/UTC',
  backgroundColor = '#0F0F0F',
  gridColor = 'rgba(242, 242, 242, 0.06)',
  width = '100%',
  height = '100%',
  autosize = true,
}: TradingViewAdvancedChartProps) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Guard: only run on client, ensure container exists
    if (typeof window === 'undefined') return
    if (!container.current) return

    // Clear previous content
    container.current.innerHTML = ''

    const script = document.createElement('script')
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    
    // Guard: ensure container still exists before setting innerHTML
    if (!container.current) return
    
    script.innerHTML = JSON.stringify({
      allow_symbol_change: allowSymbolChange,
      calendar,
      details,
      hide_side_toolbar: hideSideToolbar,
      hide_top_toolbar: hideTopToolbar,
      hide_legend: hideLegend,
      hide_volume: hideVolume,
      hotlist,
      interval,
      locale,
      save_image: saveImage,
      style,
      symbol: `${symbol}`,
      theme,
      timezone,
      backgroundColor,
      gridColor,
      watchlist: [],
      withdateranges: false,
      compareSymbols: [],
      studies: [],
      autosize,
    })

    // Guard: ensure container still exists before appending
    if (!container.current) return
    
    container.current.appendChild(script)

    // Hide copyright elements that TradingView injects
    const hideCopyright = () => {
      if (!container.current) return
      try {
        const copyrightElements = container.current.querySelectorAll('.tradingview-widget-copyright')
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
    if (container.current) {
      observer.observe(container.current, { childList: true, subtree: true })
    }

    return () => {
      observer.disconnect()
      // Clean up script on unmount
      if (container.current) {
        container.current.innerHTML = ''
      }
    }
  }, [
    symbol,
    allowSymbolChange,
    calendar,
    details,
    hideSideToolbar,
    hideTopToolbar,
    hideLegend,
    hideVolume,
    hotlist,
    interval,
    locale,
    saveImage,
    style,
    theme,
    timezone,
    backgroundColor,
    gridColor,
    autosize,
  ])

  return (
    <div
      className="tradingview-widget-container"
      ref={container}
      style={{ height: '100%', width: '100%' }}
    >
      <div
        className="tradingview-widget-container__widget"
        style={{ height: '100%', width: '100%' }}
      ></div>
    </div>
  )
}

export default memo(TradingViewAdvancedChart)

