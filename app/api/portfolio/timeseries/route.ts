import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth-server'
import { getPortfolioSnapshots, getSectionsForRange } from '@/lib/portfolio-snapshots'
import { calculateMarkToMarket } from '@/lib/portfolio-mark-to-market'
import { listPositions } from '@/lib/portfolio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/portfolio/timeseries
 * Returns portfolio time-series data from snapshots
 * 
 * For 1H: Returns last 60 minutes from latest snapshot (never empty)
 * For 1D: Returns last trading session (Friday's data on weekends)
 * For other ranges: Returns snapshots within the range
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const rawRange = url.searchParams.get('range') || '1d'
    const gran = url.searchParams.get('gran') || '1d'
    const rangeKey = rawRange.toLowerCase()
    
    // Map API range names to internal range names (handle both formats)
    const rangeMap: Record<string, string> = {
      '1h': '1h',
      '60m': '1h',
      '1hour': '1h',
      '1d': '1d',
      '24h': '1d',
      '1day': '1d',
      '3d': '3d',
      '72h': '3d',
      '1w': '1week',
      '1week': '1week',
      '7d': '1week',
      '1m': '1m',
      '30d': '1m',
      '1month': '1m',
      '3m': '3m',
      '90d': '3m',
      '6m': '6m',
      '180d': '6m',
      '1y': '1y',
      '12m': '1y',
      '365d': '1y',
      'all': 'all',
      'max': 'all'
    }
    const apiRange = rangeMap[rangeKey] || rangeKey || '1d'
    
    // Get snapshots from database (handles all ranges with proper time windows and downsampling)
    const { snapshots, startTime, endTime, range: normalizedRange, sections } = await getPortfolioSnapshots(userId, apiRange, gran)
    
    // Get sections - for 1H, ensure exactly 60 minutes from startTime to endTime
    let sectionTimestamps = sections.length > 0
      ? sections
      : getSectionsForRange(normalizedRange, startTime, endTime)
    
    // For 1H, regenerate sections to ensure exactly 60 minutes
    if (normalizedRange === '1h') {
      sectionTimestamps = getSectionsForRange('1h', startTime, endTime)
    }
    
    // Validate sections are numbers and sort them
    sectionTimestamps = sectionTimestamps
      .map((ts: any) => Number(ts))
      .filter((ts: number) => Number.isFinite(ts))
      .sort((a: number, b: number) => a - b)
    
    // Debug logging for 1H range
    if (normalizedRange === '1h' && sectionTimestamps.length > 0) {
      const firstTime = new Date(sectionTimestamps[0]).toISOString()
      const lastTime = new Date(sectionTimestamps[sectionTimestamps.length - 1]).toISOString()
      const durationMinutes = (sectionTimestamps[sectionTimestamps.length - 1] - sectionTimestamps[0]) / (60 * 1000)
      console.log(`[Timeseries 1H] startTime: ${new Date(startTime).toISOString()}, endTime: ${new Date(endTime).toISOString()}`)
      console.log(`[Timeseries 1H] Sections: ${sectionTimestamps.length}, First: ${firstTime}, Last: ${lastTime}, Duration: ${durationMinutes.toFixed(1)} minutes`)
    }

    // If no snapshots, try to create points from current portfolio state
    // Use /api/portfolio endpoint to get current holdings with live prices (same as dashboard)
    if (snapshots.length === 0) {
      const positions = listPositions(userId)
      if (positions.length > 0) {
        // Fetch current portfolio data (uses /api/stocks for prices - same as dashboard holdings)
        const protocol = req.headers.get('x-forwarded-proto') || 'http'
        const host = req.headers.get('host') || 'localhost:3000'
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
        
        let currentPortfolioData: any = null
        try {
          const portfolioRes = await fetch(`${baseUrl}/api/portfolio?enrich=1`, {
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' }
          })
          if (portfolioRes.ok) {
            currentPortfolioData = await portfolioRes.json()
          }
        } catch (err: any) {
          console.error('Failed to fetch current portfolio for timeseries:', err.message)
        }
        
        // Use current portfolio totals if available, otherwise calculate from positions
        const tpv = currentPortfolioData?.totals?.tpv || 
          currentPortfolioData?.items?.reduce((sum: number, h: any) => sum + (h.totalValue || 0), 0) || 0
        const costBasis = currentPortfolioData?.totals?.costBasis ||
          currentPortfolioData?.items?.reduce((sum: number, h: any) => sum + (h.totalCost || 0), 0) ||
          positions.reduce((sum, p) => sum + (p.totalCost || p.avgPrice * p.totalShares || 0), 0)
        const totalReturn = tpv - costBasis
        const totalReturnPct = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0
        
        const basePoint = {
          portfolio: tpv,
          portfolioAbs: tpv,
          costBasis: costBasis,
          costBasisAbs: costBasis,
          netInvested: costBasis,
          netInvestedAbs: costBasis,
          deltaFromStart$: 0,
          deltaFromStartPct: 0,
          overallReturn$: totalReturn,
          overallReturnPct: totalReturnPct,
          holdingsCount: positions.length
        }
        
        // Create series with CURRENT portfolio value for all points
        // Each point will show the portfolio value at that specific time
        // The last point will be updated with current value as snapshots are created
        const syntheticSeries = sectionTimestamps.length > 0
          ? sectionTimestamps.map((ts) => ({ ...basePoint, t: ts }))
          : [
              { ...basePoint, t: startTime },
              { ...basePoint, t: endTime },
            ]
        
        // LAST point always shows CURRENT dashboard portfolio value (most recent)
        if (syntheticSeries.length > 0) {
          const lastPoint = syntheticSeries[syntheticSeries.length - 1]
          lastPoint.portfolio = tpv // Current dashboard value
          lastPoint.portfolioAbs = tpv
          lastPoint.overallReturn$ = totalReturn
          lastPoint.overallReturnPct = totalReturnPct
          lastPoint.t = endTime // Current time
        }

        return NextResponse.json({
          range: rawRange,
          granularity: gran,
          currency: 'USD',
          series: syntheticSeries,
          sections: sectionTimestamps,
          window: { startTime, endTime },
          totals: {
            tpv,
            costBasis,
            totalReturn,
            totalReturnPct
          },
          meta: {
            symbols: positions.map(p => p.symbol),
            hasFx: false,
            lastQuoteTs: new Date().toISOString(),
            startIndex: 0,
            startPortfolioAbs: tpv
          }
        })
      }

      // No positions, return empty
        return NextResponse.json({
          range: rawRange,
          granularity: gran,
          currency: 'USD',
          series: [],
          sections: sectionTimestamps,
          window: { startTime, endTime },
        totals: {
          tpv: 0,
          costBasis: 0,
          totalReturn: 0,
          totalReturnPct: 0
        },
          meta: {
            symbols: [],
            hasFx: false,
            lastQuoteTs: new Date().toISOString(),
            startIndex: 0,
            startPortfolioAbs: 0
          }
        })
      }
      
    // Convert snapshots to series format
    // CRITICAL: Use ACTUAL snapshot values - each point shows portfolio value at that specific time
    // snapshot.tpv is the ACTUAL portfolio value when that snapshot was taken
    // FIX: If tpv = 0 but costBasis > 0, use costBasis (snapshot was saved incorrectly)
    const series = snapshots.map((snapshot, index) => {
      // FIX: If tpv is 0 but we have costBasis, use costBasis (data corruption fix)
      const actualTpv = snapshot.tpv > 0 ? snapshot.tpv : (snapshot.costBasis > 0 ? snapshot.costBasis : 0)
      const actualReturn = snapshot.totalReturn !== 0 ? snapshot.totalReturn : (actualTpv - snapshot.costBasis)
      const actualReturnPct = snapshot.totalReturnPct !== 0 ? snapshot.totalReturnPct : 
        (snapshot.costBasis > 0 ? ((actualTpv - snapshot.costBasis) / snapshot.costBasis) * 100 : 0)
      
      // Calculate delta from start (first snapshot)
      const firstTpv = snapshots[0].tpv > 0 ? snapshots[0].tpv : (snapshots[0].costBasis > 0 ? snapshots[0].costBasis : 0)
      const deltaFromStart$ = actualTpv - firstTpv
      const deltaFromStartPct = firstTpv > 0 ? (deltaFromStart$ / firstTpv) * 100 : 0
      
      // Use ACTUAL snapshot values - these show what happened historically
      // snapshot.timestamp is the section timestamp (different for each point)
      // actualTpv is the ACTUAL portfolio value at that time (or costBasis if tpv was 0)
      return {
        t: snapshot.timestamp, // X-axis: timestamp (time) - different for each point
        portfolio: actualTpv, // Y-axis: ACTUAL portfolio value at this time (preserves historical movement)
        portfolioAbs: actualTpv,
        costBasis: snapshot.costBasis,
        costBasisAbs: snapshot.costBasis,
        netInvested: snapshot.costBasis,
        netInvestedAbs: snapshot.costBasis,
        deltaFromStart$,
        deltaFromStartPct,
        overallReturn$: actualReturn, // Actual return at that time
        overallReturnPct: actualReturnPct, // Actual return % at that time
        holdingsCount: snapshot.holdingsCount
      }
    })
    
    // Ensure series is sorted by timestamp ASC (should already be sorted, but safety check)
    series.sort((a, b) => a.t - b.t)
    
    // CRITICAL: Preserve ACTUAL snapshot values from database
    // Each point shows the portfolio value at that specific time (from DB snapshot)
    // Only update the LAST point if it's actually the most recent point (within last 5 seconds)
    if (series.length > 0) {
      const lastSnapshotTime = series[series.length - 1].t
      const now = Date.now()
      const isLastPointRecent = (now - lastSnapshotTime) < 5000 // Within last 5 seconds
      
      // Only update last point if it's actually recent (most recent snapshot)
      // This preserves historical values: 1:20 PM shows value at 1:20 PM, not current value
      if (isLastPointRecent) {
        const positions = listPositions(userId)
        if (positions.length > 0) {
          try {
            const protocol = req.headers.get('x-forwarded-proto') || 'http'
            const host = req.headers.get('host') || 'localhost:3000'
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
            
            const portfolioRes = await fetch(`${baseUrl}/api/portfolio?enrich=1`, {
              cache: 'no-store',
              headers: { 'Content-Type': 'application/json' }
            })
            
            if (portfolioRes.ok) {
              const currentData = await portfolioRes.json()
              const currentTpv = currentData?.totals?.tpv || 0
              const currentCostBasis = currentData?.totals?.costBasis || series[0].costBasis
              const currentReturn = currentTpv - currentCostBasis
              const currentReturnPct = currentCostBasis > 0 ? (currentReturn / currentCostBasis) * 100 : 0
              
              // Only update if we have a valid current value
              if (currentTpv > 0) {
                const lastPoint = series[series.length - 1]
                // Update ONLY the last point (most recent) with current dashboard value
                // All other points keep their ACTUAL historical snapshot values from DB
                lastPoint.portfolio = currentTpv
                lastPoint.portfolioAbs = currentTpv
                lastPoint.overallReturn$ = currentReturn
                lastPoint.overallReturnPct = currentReturnPct
                lastPoint.t = endTime // Use current time (now) for most recent point
              }
            }
          } catch (err: any) {
            console.error('Failed to fetch current portfolio for timeseries:', err.message)
            // Don't overwrite historical values if fetch fails - keep DB snapshot values
          }
        }
      } else {
        // Last point is not recent - preserve ACTUAL snapshot value from DB
        // This ensures 1:20 PM shows value at 1:20 PM, not current value
        console.log(`[Timeseries] Last snapshot is ${Math.round((now - lastSnapshotTime) / 1000)}s old - preserving DB value`)
      }
    }
    
    // Debug: Log snapshot values to verify we're using ACTUAL DB values
    if (series.length > 0) {
      console.log(`[Timeseries] Total snapshots: ${series.length}`)
      if (series.length >= 2) {
        const firstPoint = series[0]
        const lastPoint = series[series.length - 1]
        console.log(`[Timeseries] First point: ${new Date(firstPoint.t).toISOString()} = $${firstPoint.portfolio.toLocaleString()}`)
        console.log(`[Timeseries] Last point: ${new Date(lastPoint.t).toISOString()} = $${lastPoint.portfolio.toLocaleString()}`)
        console.log(`[Timeseries] Value difference: $${(lastPoint.portfolio - firstPoint.portfolio).toLocaleString()}`)
      }
      // Log a few sample points to verify they have different values
      const sampleIndices = [0, Math.floor(series.length / 2), series.length - 1]
      sampleIndices.forEach(idx => {
        if (series[idx]) {
          const point = series[idx]
          console.log(`[Timeseries] Sample point ${idx}: ${new Date(point.t).toISOString()} = $${point.portfolio.toLocaleString()}`)
        }
      })
    }
    
    // Debug: Log first and last timestamps to verify they're different
    if (series.length > 1) {
      const firstTime = new Date(series[0].t).toISOString()
      const lastTime = new Date(series[series.length - 1].t).toISOString()
      const firstValue = series[0].portfolio
      const lastValue = series[series.length - 1].portfolio
      console.log(`[Portfolio Timeseries] Range: ${rawRange}, Points: ${series.length}, First: ${firstTime} ($${firstValue.toLocaleString()}), Last: ${lastTime} ($${lastValue.toLocaleString()})`)
    }

    // Get totals from latest snapshot
    const latestSnapshot = snapshots[snapshots.length - 1]
    
    return NextResponse.json({
      range: rawRange,
      granularity: gran,
      currency: 'USD',
      series,
      sections: sectionTimestamps,
      window: { startTime, endTime },
      totals: {
        tpv: latestSnapshot.tpv,
        costBasis: latestSnapshot.costBasis,
        totalReturn: latestSnapshot.totalReturn,
        totalReturnPct: latestSnapshot.totalReturnPct
      },
      meta: {
        symbols: latestSnapshot.details?.holdings?.map((h: any) => h.symbol) || [],
        hasFx: false,
        lastQuoteTs: new Date(latestSnapshot.timestamp).toISOString(),
        startIndex: 0,
        startPortfolioAbs: snapshots[0]?.tpv || 0
      }
    })
  } catch (error: any) {
    console.error('Error fetching portfolio timeseries:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch timeseries' },
      { status: 500 }
    )
  }
}
