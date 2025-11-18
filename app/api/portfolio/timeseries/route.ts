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
      console.error('[Timeseries API] Unauthorized - no userId')
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
    let snapshots: any[] = []
    let startTime: number = Date.now()
    let endTime: number = Date.now()
    let normalizedRange: string = apiRange
    let sections: number[] = []
    
    try {
      const result = await getPortfolioSnapshots(userId, apiRange, gran)
      snapshots = result.snapshots || []
      startTime = result.startTime || Date.now()
      endTime = result.endTime || Date.now()
      normalizedRange = result.range || apiRange
      sections = result.sections || []
    } catch (error: any) {
      console.error('[Timeseries API] Error fetching snapshots:', error)
      // Continue with empty snapshots - will use fallback logic
    }
    
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
      
    // CRITICAL: Use ACTUAL database snapshot values - map 1:1 from DB to chart
    // Each snapshot = one point on the chart with its ACTUAL timestamp and tpv value
    // This preserves history: if portfolio was $8,001,000 at 12:00 and $8,000,000 at 12:05, both show
    
    // DEBUG: Log what we got from DB
    console.log(`[Timeseries API] Received ${snapshots.length} snapshots from DB`)
    if (snapshots.length > 0) {
      const sampleSnapshots = snapshots.slice(0, 5).map(s => ({
        timestamp: new Date(s.timestamp).toISOString(),
        tpv: s.tpv,
        costBasis: s.costBasis,
        totalReturn: s.totalReturn
      }))
      console.log(`[Timeseries API] Sample snapshots:`, JSON.stringify(sampleSnapshots, null, 2))
      
      const zeroTpvCount = snapshots.filter(s => s.tpv === 0).length
      const nonZeroTpvCount = snapshots.filter(s => s.tpv > 0).length
      console.log(`[Timeseries API] Snapshots with tpv=0: ${zeroTpvCount}, tpv>0: ${nonZeroTpvCount}`)
    }
    
    // CRITICAL: Filter out snapshots with tpv=0 AND costBasis=0 (completely invalid)
    // If tpv=0 but costBasis>0, we'll use costBasis as the portfolio value (fallback)
    const validSnapshots = snapshots.filter(s => {
      const hasValue = s.tpv > 0 || s.costBasis > 0
      if (!hasValue) {
        console.warn(`[Timeseries API] Filtering out invalid snapshot at ${new Date(s.timestamp).toISOString()}: tpv=${s.tpv}, costBasis=${s.costBasis}`)
      }
      return hasValue
    })
    
    if (validSnapshots.length === 0) {
      console.error('[Timeseries API] ERROR: No valid snapshots found - all have tpv=0 and costBasis=0')
      console.error('[Timeseries API] This means snapshots were saved incorrectly or portfolio has no positions')
    }
    
    // Map each snapshot directly to a chart point - NO section mapping, use ACTUAL timestamps
    // CRITICAL: Each point must have the ACTUAL portfolio value from the snapshot at that time
    const series = validSnapshots.map((snapshot, index) => {
      // Use ACTUAL snapshot.tpv from database - this is the portfolio value at that exact time
      // If tpv=0 but costBasis>0, use costBasis (data was saved before prices loaded)
      // This ensures we NEVER return 0 for portfolio value if we have valid data
      const actualTpv = snapshot.tpv > 0 ? snapshot.tpv : snapshot.costBasis
      
      // CRITICAL VALIDATION: If actualTpv is still 0, something is very wrong
      if (actualTpv === 0) {
        console.error(`[Timeseries API] ERROR: Snapshot at ${new Date(snapshot.timestamp).toISOString()} has tpv=0 and costBasis=0 - this should have been filtered out!`)
      }
      
      // Calculate returns based on actual values
      const actualReturn = snapshot.totalReturn !== 0 ? snapshot.totalReturn : (actualTpv - snapshot.costBasis)
      const actualReturnPct = snapshot.totalReturnPct !== 0 ? snapshot.totalReturnPct : 
        (snapshot.costBasis > 0 ? ((actualTpv - snapshot.costBasis) / snapshot.costBasis) * 100 : 0)
      
      // Calculate delta from start (first snapshot)
      const firstTpv = validSnapshots[0].tpv > 0 ? validSnapshots[0].tpv : validSnapshots[0].costBasis
      const deltaFromStart$ = actualTpv - firstTpv
      const deltaFromStartPct = firstTpv > 0 ? (deltaFromStart$ / firstTpv) * 100 : 0
      
      // CRITICAL: Use ACTUAL snapshot timestamp and tpv - this is the historical record
      // Example: snapshot at 12:00 PM with tpv=$8,001,000 → point at (12:00 PM, $8,001,000)
      return {
        t: snapshot.timestamp, // X-axis: ACTUAL timestamp from DB (when snapshot was saved)
        portfolio: actualTpv, // Y-axis: ACTUAL portfolio value at that time (from DB snapshot)
        portfolioAbs: actualTpv,
        costBasis: snapshot.costBasis,
        costBasisAbs: snapshot.costBasis,
        netInvested: snapshot.costBasis,
        netInvestedAbs: snapshot.costBasis,
        deltaFromStart$,
        deltaFromStartPct,
        overallReturn$: actualReturn,
        overallReturnPct: actualReturnPct,
        holdingsCount: snapshot.holdingsCount
      }
    })
    
    // Ensure series is sorted by timestamp ASC (should already be sorted, but safety check)
    series.sort((a, b) => a.t - b.t)
    
    // CRITICAL: Preserve ALL historical snapshot values - DO NOT overwrite!
    // Each point already has the ACTUAL portfolio value from the database at that time
    // Example: point at 12:00 PM has tpv=$8,001,000 → shows $8,001,000, not current value
    
    // Only update the LAST point if it's very recent (within 10 seconds) to show live updates
    // All other points keep their historical DB values forever
    if (series.length > 0) {
      const lastSnapshotTime = series[series.length - 1].t
      const now = Date.now()
      const secondsSinceLastSnapshot = (now - lastSnapshotTime) / 1000
      const isLastPointVeryRecent = secondsSinceLastSnapshot < 10 // Within last 10 seconds
      
      // Only update last point if it's very recent AND we have valid current data
      // This allows the chart to show live updates while preserving all history
      if (isLastPointVeryRecent) {
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
              
              // Only update if we have a valid current value AND it's different from last snapshot
              if (currentTpv > 0) {
                const lastPoint = series[series.length - 1]
                const lastSnapshotTpv = lastPoint.portfolio
                
                // Only update if value changed significantly (avoid unnecessary overwrites)
                if (Math.abs(currentTpv - lastSnapshotTpv) > 0.01) {
                  const currentCostBasis = currentData?.totals?.costBasis || lastPoint.costBasis
                  const currentReturn = currentTpv - currentCostBasis
                  const currentReturnPct = currentCostBasis > 0 ? (currentReturn / currentCostBasis) * 100 : 0
                  
                  // Update ONLY the last point with current dashboard value
                  // All other points keep their ACTUAL historical snapshot values from DB
                  lastPoint.portfolio = currentTpv
                  lastPoint.portfolioAbs = currentTpv
                  lastPoint.overallReturn$ = currentReturn
                  lastPoint.overallReturnPct = currentReturnPct
                  lastPoint.t = now // Use current time for most recent point
                }
              }
            }
          } catch (err: any) {
            console.error('Failed to fetch current portfolio for timeseries:', err.message)
            // Don't overwrite historical values if fetch fails - keep DB snapshot values
          }
        }
      } else {
        // Last point is not recent - preserve ACTUAL snapshot value from DB
        // This ensures historical points show their actual values, not current value
        console.log(`[Timeseries] Last snapshot is ${Math.round(secondsSinceLastSnapshot)}s old - preserving DB value $${series[series.length - 1].portfolio.toLocaleString()}`)
      }
    }
    
    // Debug: Log snapshot values to verify we're using ACTUAL DB values
    if (series.length > 0) {
      console.log(`[Timeseries] Total snapshots: ${series.length}`)
      if (series.length >= 2) {
        const firstPoint = series[0]
        const lastPoint = series[series.length - 1]
        if (firstPoint && lastPoint && typeof firstPoint.portfolio === 'number' && typeof lastPoint.portfolio === 'number') {
          console.log(`[Timeseries] First point: ${new Date(firstPoint.t).toISOString()} = $${firstPoint.portfolio.toLocaleString()}`)
          console.log(`[Timeseries] Last point: ${new Date(lastPoint.t).toISOString()} = $${lastPoint.portfolio.toLocaleString()}`)
          console.log(`[Timeseries] Value difference: $${(lastPoint.portfolio - firstPoint.portfolio).toLocaleString()}`)
        }
      }
      // Log a few sample points to verify they have different values
      const sampleIndices = [0, Math.floor(series.length / 2), series.length - 1]
      sampleIndices.forEach(idx => {
        if (series[idx] && typeof series[idx].portfolio === 'number') {
          const point = series[idx]
          console.log(`[Timeseries] Sample point ${idx}: ${new Date(point.t).toISOString()} = $${point.portfolio.toLocaleString()}`)
        }
      })
    }
    
    // Debug: Log first and last timestamps to verify they're different
    if (series.length > 1 && series[0] && series[series.length - 1]) {
      const firstTime = new Date(series[0].t).toISOString()
      const lastTime = new Date(series[series.length - 1].t).toISOString()
      const firstValue = series[0].portfolio || 0
      const lastValue = series[series.length - 1].portfolio || 0
      console.log(`[Portfolio Timeseries] Range: ${rawRange}, Points: ${series.length}, First: ${firstTime} ($${firstValue.toLocaleString()}), Last: ${lastTime} ($${lastValue.toLocaleString()})`)
    }

    // Get totals from latest snapshot (or use series data if snapshots empty)
    const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
    const lastSeriesPoint = series.length > 0 ? series[series.length - 1] : null
    
    return NextResponse.json({
      range: rawRange,
      granularity: gran,
      currency: 'USD',
      series,
      sections: sectionTimestamps,
      window: { startTime, endTime },
      totals: {
        tpv: latestSnapshot?.tpv || lastSeriesPoint?.portfolio || 0,
        costBasis: latestSnapshot?.costBasis || lastSeriesPoint?.costBasis || 0,
        totalReturn: latestSnapshot?.totalReturn || lastSeriesPoint?.overallReturn$ || 0,
        totalReturnPct: latestSnapshot?.totalReturnPct || lastSeriesPoint?.overallReturnPct || 0
      },
      meta: {
        symbols: latestSnapshot?.details?.holdings?.map((h: any) => h.symbol) || [],
        hasFx: false,
        lastQuoteTs: latestSnapshot?.timestamp ? new Date(latestSnapshot.timestamp).toISOString() : new Date().toISOString(),
        startIndex: 0,
        startPortfolioAbs: snapshots[0]?.tpv || series[0]?.portfolio || 0
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
