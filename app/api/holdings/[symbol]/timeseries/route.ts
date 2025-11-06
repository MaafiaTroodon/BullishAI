import { NextRequest, NextResponse } from 'next/server'
import { listTransactions } from '@/lib/portfolio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUserId() { return 'demo-user' }

async function getHistoricalPrices(symbol: string, range: string, startTime: number, endTime: number): Promise<Array<{t: number, c: number}>> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/chart?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    if (!data?.data || !Array.isArray(data.data)) return []
    
    return data.data
      .filter((p: any) => {
        const t = p.t || p.timestamp
        return typeof t === 'number' && t >= startTime && t <= endTime
      })
      .map((p: any) => ({
        t: p.t || p.timestamp,
        c: p.c ?? p.close ?? p.price ?? 0
      }))
      .filter((p: any) => p.c > 0)
      .sort((a: any, b: any) => a.t - b.t)
  } catch {
    return []
  }
}

function forwardFillPrices(prices: Array<{t: number, c: number}>, timestamps: number[]): Map<number, number> {
  const priceMap = new Map<number, number>()
  let lastPrice = 0
  
  for (const ts of timestamps) {
    const priceAt = prices.find(p => p.t <= ts && p.c > 0)
    if (priceAt) {
      lastPrice = priceAt.c
    }
    if (lastPrice > 0) {
      priceMap.set(ts, lastPrice)
    }
  }
  
  return priceMap
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId()
    const url = new URL(req.url)
    const symbol = (url.pathname.split('/').pop() || '').toUpperCase()
    const url = new URL(req.url)
    const range = url.searchParams.get('range') || '1M'
    const gran = url.searchParams.get('gran') || '1d'
    
    const transactions = listTransactions(userId).filter(t => t.symbol.toUpperCase() === symbol)
    
    if (transactions.length === 0) {
      return NextResponse.json({
        symbol,
        currency: 'USD',
        series: []
      })
    }
    
    const now = Date.now()
    const rangeMs: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '1week': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
      '3M': 90 * 24 * 60 * 60 * 1000,
      '6M': 180 * 24 * 60 * 60 * 1000,
      '1Y': 365 * 24 * 60 * 60 * 1000,
      'ALL': Infinity
    }
    
    const rangeBack = rangeMs[range] || 30 * 24 * 60 * 60 * 1000
    const startTime = range === 'ALL' ? Math.min(...transactions.map(t => t.timestamp)) : now - rangeBack
    
    const granMs: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    }
    const interval = granMs[gran] || 24 * 60 * 60 * 1000
    
    const buckets: number[] = []
    for (let t = startTime; t <= now; t += interval) {
      buckets.push(t)
    }
    buckets.push(now)
    
    // Fetch prices
    const prices = await getHistoricalPrices(symbol, range, startTime, now)
    const priceMap = forwardFillPrices(prices, buckets)
    
    // Process transactions to build position over time
    const sortedTx = transactions.sort((a, b) => a.timestamp - b.timestamp)
    let shares = 0
    let avgCost = 0
    let costBasis = 0
    
    const series: Array<{
      t: number
      value: number
      costBasis: number
      qty: number
      price: number
      unrealized: number
    }> = []
    
    let txIndex = 0
    
    for (const bucket of buckets) {
      // Process transactions up to this bucket
      while (txIndex < sortedTx.length && sortedTx[txIndex].timestamp <= bucket) {
        const tx = sortedTx[txIndex]
        
        if (tx.action === 'buy') {
          const qty = tx.quantity || 0
          const price = tx.price || 0
          const oldShares = shares
          const oldAvg = avgCost
          shares += qty
          avgCost = shares > 0 ? ((oldShares * oldAvg) + (qty * price)) / shares : price
          costBasis = shares * avgCost
        } else if (tx.action === 'sell') {
          const qty = Math.min(tx.quantity || 0, shares)
          shares -= qty
          costBasis = shares * avgCost
          if (shares <= 0) {
            avgCost = 0
            costBasis = 0
          }
        }
        
        txIndex++
      }
      
      const price = priceMap.get(bucket) || avgCost || 0
      const value = shares * price
      const unrealized = value - costBasis
      
      series.push({
        t: bucket,
        value: Number(value.toFixed(2)),
        costBasis: Number(costBasis.toFixed(2)),
        qty: Number(shares.toFixed(4)),
        price: Number(price.toFixed(2)),
        unrealized: Number(unrealized.toFixed(2))
      })
    }
    
    return NextResponse.json({
      symbol,
      currency: 'USD',
      series
    })
  } catch (error: any) {
    console.error('Holding timeseries error:', error)
    return NextResponse.json({ error: error.message || 'timeseries_error' }, { status: 500 })
  }
}

