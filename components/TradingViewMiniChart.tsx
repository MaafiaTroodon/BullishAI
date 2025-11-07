'use client'

import { useEffect, useRef, memo } from 'react'

interface TradingViewMiniChartProps {
  symbol: string
  exchange?: string
  width?: string
  height?: string
}

function TradingViewMiniChart({ symbol, exchange = 'NASDAQ', width = '100%', height = '100%' }: TradingViewMiniChartProps) {
  const container = useRef<HTMLDivElement>(null)
  const scriptLoaded = useRef(false)

  useEffect(() => {
    if (!container.current || scriptLoaded.current) return

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol: `${exchange}:${symbol}`,
      chartOnly: false,
      dateRange: '12M',
      noTimeScale: false,
      colorTheme: 'dark',
      isTransparent: false,
      locale: 'en',
      width: width,
      autosize: true,
      height: height
    })

    container.current.appendChild(script)
    scriptLoaded.current = true

    return () => {
      if (container.current && script.parentNode) {
        script.parentNode.removeChild(script)
        scriptLoaded.current = false
      }
    }
  }, [symbol, exchange, width, height])

  return (
    <div className="tradingview-widget-container" ref={container} style={{ width, height, minHeight: '40px' }}>
      <div className="tradingview-widget-container__widget"></div>
    </div>
  )
}

export default memo(TradingViewMiniChart)
