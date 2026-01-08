import { NextRequest, NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { symbol: string } }) {
  try {
    const symbol = params.symbol.toUpperCase()
    const [listRes, transcriptRes] = await Promise.all([
      finnhubFetch('stock/transcripts/list', { symbol }, { cacheSeconds: 3600 }),
      finnhubFetch('stock/transcripts', { symbol }, { cacheSeconds: 3600 }),
    ])

    return NextResponse.json(
      {
        symbol,
        list: listRes.data || [],
        transcript: transcriptRes.data || null,
      },
      {
        headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' },
      }
    )
  } catch (error: any) {
    console.error('Transcripts API error:', error)
    return NextResponse.json(
      { error: error.message || 'transcripts_error' },
      { status: 500 }
    )
  }
}
