// lib/portfolio-series.ts
// Single source of truth for portfolio chart data

import { listPositions, listWalletTransactions } from './portfolio'

export type Range = '1H' | '1D' | '3D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'

export type PortfolioSeriesPoint = { 
  t: number  // ET epoch milliseconds
  pv: number // Portfolio Value: Σ(shares_i * price_i(t))
  nd: number // Net Deposits: running sum of deposits - withdrawals
}

// Map range to candle resolution
function getCandleResolution(range: Range): string {
  switch (range) {
    case '1H': return '5m' // 5-minute candles
    case '1D': 
    case '3D': return '15m' // 15-minute candles
    case '1W':
    case '1M': return '1h' // 1-hour candles
    case '3M':
    case '6M':
    case '1Y':
    case 'ALL': return '1d' // Daily candles
  }
}

// Get time window for range (in ET)
function getTimeWindow(range: Range): { start: number; end: number } {
  const now = Date.now()
  const etNow = new Date(now)
  // Convert to ET (America/New_York)
  const etOffset = -5 * 60 * 60 * 1000 // EST offset (simplified, should handle DST)
  const etTime = now + etOffset
  
  const rangeMs: Record<Range, number> = {
    '1H': 60 * 60 * 1000,
    '1D': 24 * 60 * 60 * 1000,
    '3D': 3 * 24 * 60 * 60 * 1000,
    '1W': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,
    '3M': 90 * 24 * 60 * 60 * 1000,
    '6M': 180 * 24 * 60 * 60 * 1000,
    '1Y': 365 * 24 * 60 * 60 * 1000,
    'ALL': Infinity
  }
  
  const rangeBack = rangeMs[range] || 30 * 24 * 60 * 60 * 1000
  const start = range === 'ALL' ? 0 : now - rangeBack
  
  return { start, end: now }
}

// Fetch candles for a symbol
async function getCandles(symbol: string, range: Range, baseUrl: string): Promise<Array<{t: number, c: number}>> {
  try {
    // Map range to chart API range format
    const chartRangeMap: Record<Range, string> = {
      '1H': '1d',
      '1D': '1d',
      '3D': '3d',
      '1W': '1week',
      '1M': '1m',
      '3M': '3m',
      '6M': '6m',
      '1Y': '1y',
      'ALL': 'max'
    }
    
    const chartRange = chartRangeMap[range] || '1m'
    const res = await fetch(`${baseUrl}/api/chart?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(chartRange)}`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    if (!data?.data || !Array.isArray(data.data)) return []
    
    return data.data
      .map((p: any) => ({
        t: p.t || p.timestamp,
        c: p.c ?? p.close ?? p.price ?? 0
      }))
      .filter((p: any) => p.c > 0 && p.t > 0)
      .sort((a: any, b: any) => a.t - b.t)
  } catch {
    return []
  }
}

// Forward-fill last known price
function forwardFillPrice(candles: Array<{t: number, c: number}>, timestamp: number): number {
  if (candles.length === 0) return 0
  
  // Find last known price at or before timestamp
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].t <= timestamp && candles[i].c > 0) {
      return candles[i].c
    }
  }
  
  // If no price found, use first available price
  return candles[0]?.c || 0
}

export async function getPortfolioSeries(userId: string, range: Range, baseUrl: string): Promise<PortfolioSeriesPoint[]> {
  // 1) Load current positions
  const positions = listPositions(userId)
  
  // 2) Get time window
  const { start, end } = getTimeWindow(range)
  
  // 3) Fetch candles for all held symbols
  const symbolCandles: Record<string, Array<{t: number, c: number}>> = {}
  await Promise.all(positions.map(async (pos) => {
    if (pos.totalShares > 0) {
      const candles = await getCandles(pos.symbol, range, baseUrl)
      if (candles.length > 0) {
        symbolCandles[pos.symbol] = candles
      }
    }
  }))
  
  // 4) Build unified timeline (union of all candle timestamps + wallet transaction timestamps)
  const walletTx = listWalletTransactions(userId)
  const allTimestamps = new Set<number>()
  
  // Add candle timestamps
  Object.values(symbolCandles).forEach(candles => {
    candles.forEach(c => {
      if (c.t >= start && c.t <= end) {
        allTimestamps.add(c.t)
      }
    })
  })
  
  // Add wallet transaction timestamps
  walletTx.forEach(tx => {
    const ts = tx.timestamp || 0
    if (ts >= start && ts <= end) {
      allTimestamps.add(ts)
    }
  })
  
  // Always include start and end
  allTimestamps.add(start)
  allTimestamps.add(end)
  
  // Sort timestamps
  const timeline = Array.from(allTimestamps).sort((a, b) => a - b)
  
  // Dedupe equal timestamps
  const dedupedTimeline: number[] = []
  let lastT = -1
  for (const t of timeline) {
    if (t !== lastT) {
      dedupedTimeline.push(t)
      lastT = t
    }
  }
  
  // 5) For each timestamp: calculate pv[t] = Σ(shares_s * price_s(t))
  // 6) Calculate nd[t] = running sum of wallet movements
  const series: PortfolioSeriesPoint[] = []
  let netDeposits = 0
  
  // Process wallet transactions chronologically
  const sortedWalletTx = [...walletTx].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
  let walletTxIndex = 0
  
  for (const t of dedupedTimeline) {
    // Process wallet transactions up to this timestamp
    while (walletTxIndex < sortedWalletTx.length && (sortedWalletTx[walletTxIndex].timestamp || 0) <= t) {
      const tx = sortedWalletTx[walletTxIndex]
      if (tx.action === 'deposit') {
        netDeposits += tx.amount || 0
      } else if (tx.action === 'withdraw') {
        netDeposits -= tx.amount || 0
      }
      walletTxIndex++
    }
    
    // Calculate portfolio value at this timestamp
    let portfolioValue = 0
    for (const pos of positions) {
      if (pos.totalShares > 0) {
        const candles = symbolCandles[pos.symbol]
        if (candles && candles.length > 0) {
          const price = forwardFillPrice(candles, t)
          portfolioValue += pos.totalShares * price
        }
      }
    }
    
    series.push({
      t,
      pv: Number(portfolioValue.toFixed(2)),
      nd: Number(netDeposits.toFixed(2))
    })
  }
  
  return series
}

