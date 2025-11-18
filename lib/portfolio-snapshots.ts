/**
 * Portfolio snapshot utilities for time-series data
 * Simple "now-based" sliding windows - no special market-hours logic
 */

export interface PortfolioSnapshot {
  id: string
  userId: string
  timestamp: number
  tpv: number
  walletBalance: number
  costBasis: number
  totalReturn: number
  totalReturnPct: number
  holdingsCount: number
  details?: any
}

/**
 * Get portfolio snapshots from database with evenly spaced X-axis sections
 * 
 * Rules:
 * - All data comes from portfolio_snapshots table (single source of truth)
 * - Always use "now-based" windows: now - RANGE_DURATION → now
 * - Split X-axis into evenly spaced sections for each range
 * - Map snapshots to nearest section (one point per section)
 * - Return sorted array by timestamp ASC
 */
export interface PortfolioSnapshotsResult {
  snapshots: PortfolioSnapshot[]
  startTime: number
  endTime: number
  range: string
  sections: number[]
}

export async function getLatestPortfolioSnapshot(userId: string): Promise<PortfolioSnapshot | null> {
  const { pool } = await import('./db-sql')
  const client = await pool.connect()

  try {
    const result = await client.query(
      `SELECT 
        id,
        "userId",
        EXTRACT(EPOCH FROM "timestamp") * 1000 as "timestamp",
        tpv,
        "walletBalance",
        "costBasis",
        "totalReturn",
        "totalReturnPct",
        "holdingsCount",
        details
       FROM portfolio_snapshots
       WHERE "userId" = $1
       ORDER BY "timestamp" DESC
       LIMIT 1`,
      [userId]
    )

    if (!result.rows.length) {
      return null
    }

    const row = result.rows[0]
    let parsedDetails = row.details
    if (parsedDetails && typeof parsedDetails === 'string') {
      try {
        parsedDetails = JSON.parse(parsedDetails)
      } catch {
        parsedDetails = null
      }
    }
    return {
      id: row.id,
      userId: row.userId,
      timestamp: Math.floor(row.timestamp),
      tpv: row.tpv,
      walletBalance: row.walletBalance,
      costBasis: row.costBasis,
      totalReturn: row.totalReturn,
      totalReturnPct: row.totalReturnPct,
      holdingsCount: row.holdingsCount || 0,
      details: parsedDetails,
    }
  } catch (error: any) {
    if (error.message?.includes('does not exist')) {
      return null
    }
    console.error('Error getting latest portfolio snapshot:', error)
    return null
  } finally {
    client.release()
  }
}

export async function getPortfolioSnapshots(
  userId: string,
  range: string,
  gran?: string
): Promise<PortfolioSnapshotsResult> {
  const { pool } = await import('./db-sql')
  const client = await pool.connect()

  try {
    const now = Date.now()
    const normalizedRange = normalizeRange(range)
    let startTime: number
    let endTime: number = now

    // Simple sliding windows: now - RANGE_DURATION → now
    if (normalizedRange === '1h') {
      // 1H: now - 60 minutes → now
      startTime = now - (60 * 60 * 1000)
    } else if (normalizedRange === '1d') {
      // 1D: now - 24 hours → now
      startTime = now - (24 * 60 * 60 * 1000)
    } else if (normalizedRange === '3d') {
      // 3D: now - 3 * 24h → now
      startTime = now - (3 * 24 * 60 * 60 * 1000)
    } else if (normalizedRange === '1week') {
      // 1W: now - 7 days → now
      startTime = now - (7 * 24 * 60 * 60 * 1000)
    } else if (normalizedRange === '1m') {
      // 1M: now - 30 days → now
      startTime = now - (30 * 24 * 60 * 60 * 1000)
    } else if (normalizedRange === '3m') {
      // 3M: now - 90 days → now
      startTime = now - (90 * 24 * 60 * 60 * 1000)
    } else if (normalizedRange === '6m') {
      // 6M: now - 180 days → now
      startTime = now - (180 * 24 * 60 * 60 * 1000)
    } else if (normalizedRange === '1y') {
      // 1Y: now - 365 days → now
      startTime = now - (365 * 24 * 60 * 60 * 1000)
    } else if (normalizedRange === 'all') {
      // ALL: first_snapshot_timestamp → now
      const earliestResult = await client.query(
        `SELECT MIN("timestamp") as earliest FROM portfolio_snapshots WHERE "userId" = $1`,
        [userId]
      )
      if (earliestResult.rows[0]?.earliest) {
        startTime = new Date(earliestResult.rows[0].earliest).getTime()
      } else {
        // No snapshots yet, use last 30 days as default
        startTime = now - (30 * 24 * 60 * 60 * 1000)
      }
    } else {
      // Default: last 30 days
      startTime = now - (30 * 24 * 60 * 60 * 1000)
    }

    // Query all snapshots within time range: WHERE timestamp BETWEEN (now - RANGE_DURATION) AND now
    const result = await client.query(
      `SELECT 
        id,
        "userId",
        EXTRACT(EPOCH FROM "timestamp") * 1000 as "timestamp",
        tpv,
        "walletBalance",
        "costBasis",
        "totalReturn",
        "totalReturnPct",
        "holdingsCount",
        details
       FROM portfolio_snapshots
       WHERE "userId" = $1 
         AND EXTRACT(EPOCH FROM "timestamp") * 1000 >= $2
         AND EXTRACT(EPOCH FROM "timestamp") * 1000 <= $3
       ORDER BY "timestamp" ASC`,
      [userId, startTime, endTime]
    )

    let snapshots = result.rows.map((row: any) => {
      let parsedDetails = row.details
      if (parsedDetails && typeof parsedDetails === 'string') {
        try {
          parsedDetails = JSON.parse(parsedDetails)
        } catch {
          parsedDetails = null
        }
      }
      return {
        id: row.id,
        userId: row.userId,
        timestamp: Math.floor(row.timestamp),
        tpv: row.tpv,
        walletBalance: row.walletBalance,
        costBasis: row.costBasis,
        totalReturn: row.totalReturn,
        totalReturnPct: row.totalReturnPct,
        holdingsCount: row.holdingsCount || 0,
        details: parsedDetails,
      }
    })

    // Create evenly spaced sections for the requested window
    const sections = getSectionsForRange(normalizedRange, startTime, endTime)

    // Downsample if necessary to keep chart performant
    snapshots = downsampleSnapshots(snapshots, normalizedRange)

    // If no snapshots, return metadata with empty array (sections still included)
    if (snapshots.length === 0) {
      return {
        snapshots: [],
        startTime,
        endTime,
        range: normalizedRange,
        sections,
      }
    }

    // Map snapshots to nearest section (one point per section)
    const sectionedSnapshots = mapSnapshotsToSections(snapshots, sections)
    
    // Return sorted by timestamp ASC
    return {
      snapshots: sectionedSnapshots.sort((a, b) => a.timestamp - b.timestamp),
      startTime,
      endTime,
      range: normalizedRange,
      sections,
    }
  } catch (error: any) {
    if (error.message?.includes('does not exist')) {
      console.warn('portfolio_snapshots table not found')
      const fallbackRange = normalizeRange(range)
      const fallbackEnd = Date.now()
      const fallbackStart = fallbackEnd - (30 * 24 * 60 * 60 * 1000)
      return {
        snapshots: [],
        startTime: fallbackStart,
        endTime: fallbackEnd,
        range: fallbackRange,
        sections: getSectionsForRange(fallbackRange, fallbackStart, fallbackEnd),
      }
    }
    console.error('Error getting portfolio snapshots:', error)
    const fallbackRange = normalizeRange(range)
    const fallbackEnd = Date.now()
    const fallbackStart = fallbackEnd - (30 * 24 * 60 * 60 * 1000)
    return {
      snapshots: [],
      startTime: fallbackStart,
      endTime: fallbackEnd,
      range: fallbackRange,
      sections: getSectionsForRange(fallbackRange, fallbackStart, fallbackEnd),
    }
  } finally {
    client.release()
  }
}

/**
 * Downsample snapshots if more than 300 points
 * Group by time bucket and average to keep chart smooth
 */
function downsampleSnapshots(snapshots: PortfolioSnapshot[], range: string): PortfolioSnapshot[] {
  if (snapshots.length === 0) return []
  if (snapshots.length <= 300) return snapshots

  // Determine bucket size based on range
  let bucketSize: number
  if (range === '1m' || range === '3m') {
    bucketSize = 60 * 60 * 1000 // 1 hour buckets
  } else if (range === '6m' || range === '1y') {
    bucketSize = 6 * 60 * 60 * 1000 // 6 hour buckets
  } else if (range === 'all') {
    bucketSize = 24 * 60 * 60 * 1000 // 1 day buckets
  } else {
    bucketSize = 30 * 60 * 1000 // 30 minute buckets (default)
  }

  // Group by time bucket
  const buckets = new Map<number, PortfolioSnapshot[]>()
  for (const snapshot of snapshots) {
    const bucket = Math.floor(snapshot.timestamp / bucketSize) * bucketSize
    if (!buckets.has(bucket)) {
      buckets.set(bucket, [])
    }
    buckets.get(bucket)!.push(snapshot)
  }

  // Take the last snapshot in each bucket (most recent)
  const downsampled: PortfolioSnapshot[] = []
  for (const [bucketTime, bucketSnapshots] of buckets.entries()) {
    if (bucketSnapshots.length === 0) continue
    
    // Take the last snapshot in the bucket (most recent)
    const sorted = bucketSnapshots.sort((a, b) => a.timestamp - b.timestamp)
    downsampled.push(sorted[sorted.length - 1])
  }

  return downsampled.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Get evenly spaced sections for X-axis based on range
 * Returns array of timestamps representing section boundaries
 * CRITICAL: Each section must have a DIFFERENT timestamp so the chart shows real time movement
 */
export function getSectionsForRange(range: string, startTime: number, endTime: number): number[] {
  const normalized = normalizeRange(range)
  const config = getSectionConfig(normalized)
  const points = Math.max(config.points, 2)
  const rawDuration = Math.max(endTime - startTime, 1)

  // For 1H, generate exactly 60 sections, one per minute, from startTime to endTime
  if (normalized === '1h') {
    const sections: number[] = []
    const minuteMs = 60 * 1000
    const now = Date.now()
    const oneHourAgo = now - (60 * minuteMs)
    
    // Use actual now and oneHourAgo to ensure exactly 60 minutes
    const actualStart = Math.max(startTime, oneHourAgo)
    const actualEnd = Math.min(endTime, now)
    
    // Generate exactly 60 sections (one per minute) - ensure each is unique
    for (let i = 0; i <= 60; i++) {
      const sectionTime = actualStart + (i * minuteMs)
      if (sectionTime <= actualEnd) {
        const timestamp = Math.floor(sectionTime)
        // Ensure no duplicates
        if (sections.length === 0 || sections[sections.length - 1] !== timestamp) {
          sections.push(timestamp)
        }
      }
    }
    
    // Always ensure endTime is included
    const endTimestamp = Math.floor(actualEnd)
    if (sections.length === 0 || sections[sections.length - 1] !== endTimestamp) {
      sections.push(endTimestamp)
    }
    
    // Remove duplicates and sort
    const uniqueSections = Array.from(new Set(sections)).sort((a, b) => a - b)
    
    // Ensure we have at least 2 sections
    if (uniqueSections.length < 2) {
      uniqueSections.push(uniqueSections[0] + minuteMs)
    }
    
    return uniqueSections
  }

  let bucketMs = config.bucketMs
  if (!bucketMs || bucketMs <= 0) {
    // Dynamically size bucket for ALL-time or fallback ranges
    bucketMs = Math.max(Math.floor(rawDuration / (points - 1)), 60 * 1000) // At least 1 minute
  }

  let alignedStart: number
  let alignedEnd: number
  
  alignedStart = alignDown(startTime, bucketMs)
  alignedEnd = alignUp(endTime, bucketMs)
  
  let duration = Math.max(alignedEnd - alignedStart, bucketMs)

  // If duration collapsed (e.g., only one snapshot), create synthetic window
  if (duration <= 0) {
    duration = bucketMs * (points - 1)
  }

  const step = duration / (points - 1)
  const sections: number[] = []

  for (let i = 0; i < points; i++) {
    const sectionTimestamp = alignedStart + (i * step)
    sections.push(Math.floor(sectionTimestamp))
  }

  // Ensure end timestamp lines up exactly with alignedEnd
  sections[sections.length - 1] = Math.max(sections[sections.length - 1], Math.floor(alignedEnd))

  // Remove duplicates and keep ascending order
  const uniqueSections = Array.from(new Set(sections)).sort((a, b) => a - b)
  if (uniqueSections.length === 1) {
    uniqueSections.push(uniqueSections[0] + bucketMs)
  }

  return uniqueSections
}

/**
 * Map snapshots to nearest section (one point per section)
 * CRITICAL: Each section must have a DIFFERENT timestamp so the chart shows real time movement
 * For each section, pick the closest snapshot at or before that time
 */
function mapSnapshotsToSections(
  snapshots: PortfolioSnapshot[],
  sections: number[]
): PortfolioSnapshot[] {
  if (snapshots.length === 0 || sections.length === 0) return []
  
  const mapped: PortfolioSnapshot[] = []
  let snapshotIndex = 0
  let lastKnownSnapshot: PortfolioSnapshot | null = null
  
  // CRITICAL: Each section must have a DIFFERENT timestamp
  // We iterate through sections (which have different timestamps) and map snapshots to them
  for (let sectionIdx = 0; sectionIdx < sections.length; sectionIdx++) {
    const sectionTime = sections[sectionIdx]
    
    // Skip duplicate section times (shouldn't happen, but safety check)
    if (sectionIdx > 0 && sectionTime === sections[sectionIdx - 1]) {
      continue
    }
    
    // Find the snapshot at or before this section time
    while (snapshotIndex < snapshots.length - 1 && snapshots[snapshotIndex + 1].timestamp <= sectionTime) {
      snapshotIndex++
    }
    
    // Use the snapshot at or before this section
    if (snapshotIndex < snapshots.length && snapshots[snapshotIndex].timestamp <= sectionTime) {
      const snapshot = snapshots[snapshotIndex]
      lastKnownSnapshot = snapshot
      // CRITICAL: Use section time (different for each section) but keep snapshot data
      // This ensures each point has a DIFFERENT timestamp so the chart moves
      // Example: sectionTime for 1W might be [Nov 6 14:00, Nov 7 14:00, Nov 8 14:00, ...]
      mapped.push({
        ...snapshot,
        timestamp: sectionTime // Use section time, not snapshot time - this creates the timeline
      })
    } else if (lastKnownSnapshot) {
      // Carry forward last known value if no snapshot for this section
      // Still use section time so X-axis shows proper time progression
      mapped.push({
        ...lastKnownSnapshot,
        timestamp: sectionTime // Different timestamp for each section
      })
    } else if (snapshots.length > 0) {
      // If we haven't found any snapshot yet, use the first one
      lastKnownSnapshot = snapshots[0]
      mapped.push({
        ...snapshots[0],
        timestamp: sectionTime // Use section time, ensuring different timestamp
      })
    }
  }
  
  // Ensure we have at least one point
  if (mapped.length === 0 && snapshots.length > 0) {
    const firstSnapshot = snapshots[0]
    mapped.push({
      ...firstSnapshot,
      timestamp: sections[0] || firstSnapshot.timestamp
    })
  }
  
  return mapped
}

function normalizeRange(range?: string): string {
  const key = (range || '1d').toString().toLowerCase()
  switch (key) {
    case '1h':
    case '60m':
    case '1hour':
      return '1h'
    case '3d':
    case '72h':
      return '3d'
    case '1w':
    case '1week':
    case '7d':
      return '1week'
    case '1m':
    case '30d':
    case '1month':
      return '1m'
    case '3m':
    case '90d':
      return '3m'
    case '6m':
    case '180d':
      return '6m'
    case '1y':
    case '12m':
    case '365d':
      return '1y'
    case 'all':
    case 'max':
      return 'all'
    case '1d':
    case '24h':
    case 'daily':
      return '1d'
    default:
      return '1d'
  }
}

function getSectionConfig(range: string): { points: number; bucketMs: number } {
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  switch (range) {
    case '1h':
      return { points: 60, bucketMs: minute } // 60 minutes
    case '1d':
      return { points: 24, bucketMs: hour } // hourly
    case '3d':
      return { points: 36, bucketMs: 2 * hour } // every 2 hours
    case '1week':
      return { points: 14, bucketMs: 12 * hour } // twice per day
    case '1m':
      return { points: 30, bucketMs: day } // daily
    case '3m':
      return { points: 45, bucketMs: 2 * day } // every ~2 days
    case '6m':
      return { points: 60, bucketMs: 3 * day } // every ~3 days
    case '1y':
      return { points: 60, bucketMs: 6 * day } // ≈monthly labels
    case 'all':
      return { points: 80, bucketMs: 0 } // bucket calculated dynamically
    default:
      return { points: 30, bucketMs: day }
  }
}

function alignDown(timestamp: number, bucketMs: number): number {
  if (bucketMs <= 0) return Math.floor(timestamp)
  return Math.floor(timestamp / bucketMs) * bucketMs
}

function alignUp(timestamp: number, bucketMs: number): number {
  if (bucketMs <= 0) return Math.floor(timestamp)
  return Math.ceil(timestamp / bucketMs) * bucketMs
}

