import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean)
  const range = url.searchParams.get('range') || '1m'
  const out: Record<string, any[]> = {}
  
  if (symbols.length === 0) {
    return NextResponse.json(out)
  }

  // Determine base URL from request
  const protocol = req.headers.get('x-forwarded-proto') || 'http'
  const host = req.headers.get('host') || 'localhost:3000'
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`
  
  await Promise.all(symbols.map(async (sym: string) => {
    try {
      const chartUrl = `${baseUrl}/api/chart?symbol=${encodeURIComponent(sym)}&range=${encodeURIComponent(range)}`
      const r = await fetch(chartUrl, { 
        cache: 'no-store',
        headers: {
          'User-Agent': 'BullishAI-PortfolioChart/1.0'
        }
      })
      
      if (!r.ok) {
        console.error(`Chart API failed for ${sym}: ${r.status}`)
        out[sym] = []
        return
      }
      
      const j = await r.json()
      
      if (j.error) {
        console.error(`Chart API error for ${sym}:`, j.error)
        out[sym] = []
        return
      }
      
      if (Array.isArray(j.data) && j.data.length > 0) {
        const filtered = j.data
          .filter((d:any) => {
            // Support multiple data formats
            const hasTimestamp = d && (typeof d.t === 'number' || typeof d.timestamp === 'number')
            const hasPrice = typeof d.c === 'number' || typeof d.close === 'number' || typeof d.price === 'number'
            return hasTimestamp && hasPrice
          })
          .map((d:any) => {
            // Normalize to {t, c} format
            const t = d.t || d.timestamp
            const c = d.c ?? d.close ?? d.price
            return { t: typeof t === 'number' ? t : (typeof t === 'string' ? new Date(t).getTime() : null), c: typeof c === 'number' ? c : null }
          })
          .filter((d:any) => d.t !== null && d.c !== null && d.c > 0)
        
        if (filtered.length > 0) {
          out[sym] = filtered
          console.log(`✓ Chart data for ${sym}: ${filtered.length} points`)
        } else {
          console.warn(`No valid chart data for ${sym} after filtering`)
          out[sym] = []
        }
      } else {
        console.warn(`No chart data array for ${sym}`, j)
        out[sym] = []
      }
    } catch (error: any) {
      console.error(`Chart proxy error for ${sym}:`, error.message)
      out[sym] = []
    }
  }))
  
  return NextResponse.json(out)
}


