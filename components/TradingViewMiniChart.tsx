'use client'

import { useEffect, useRef, memo } from 'react'

interface TradingViewMiniChartProps {
  symbol: string
  chartOnly?: boolean
  dateRange?: string
  noTimeScale?: boolean
  colorTheme?: 'light' | 'dark'
  isTransparent?: boolean
  width?: string
  height?: string
}

function TradingViewMiniChart({
  symbol,
  chartOnly = false,
  dateRange = '12M',
  noTimeScale = false,
  colorTheme = 'dark',
  isTransparent = false,
  width = '100%',
  height = '100%',
}: TradingViewMiniChartProps) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return

    // Suppress harmless TradingView iframe console errors in dev overlay
    const originalConsoleError = console.error
    console.error = (...args: any[]) => {
      try {
        const msg = args.map(String).join(' ')
        if (msg.includes('contentWindow') || msg.includes('iframe') || msg.includes('TradingView')) {
          return
        }
      } catch {}
      originalConsoleError.apply(console, args as any)
    }

    // Clear previous content
    container.current.innerHTML = ''

    const script = document.createElement('script')
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol: `${symbol}`,
      chartOnly,
      dateRange,
      noTimeScale,
      colorTheme,
      isTransparent,
      width,
      height,
      autosize: true,
    })

    container.current.appendChild(script)

    return () => {
      // Restore console after unmount
      console.error = originalConsoleError
      try { if (container.current) container.current.innerHTML = '' } catch {}
    }
  }, [symbol, chartOnly, dateRange, noTimeScale, colorTheme, isTransparent, width, height])

  return (
    <div className="tradingview-widget-container" ref={container}>
      <div className="tradingview-widget-container__widget"></div>
      <div className="tradingview-widget-copyright">
        <a
          href={`https://www.tradingview.com/symbols/${symbol}/`}
          rel="noopener nofollow"
          target="_blank"
        >
          <span className="text-blue-500">{symbol} price</span>
        </a>
        <span> by TradingView</span>
      </div>
    </div>
  )
}

export default memo(TradingViewMiniChart)

