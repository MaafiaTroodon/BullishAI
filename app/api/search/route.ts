import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const FINNHUB_KEY = process.env.FINNHUB_API_KEY

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')

    if (!query || query.length < 1) {
      return NextResponse.json({ results: [] })
    }

    // Use Finnhub symbol lookup
    if (FINNHUB_KEY) {
      try {
        const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_KEY}`
        const response = await axios.get(url, { timeout: 5000 })
        
        if (response.data && response.data.result && Array.isArray(response.data.result)) {
          const results = response.data.result
            .slice(0, 10)
            .map((item: any) => ({
              symbol: item.symbol,
              name: item.description || item.displaySymbol || item.symbol,
              displaySymbol: item.displaySymbol || item.symbol,
              type: item.type,
            }))
            .filter((item: any) => item.symbol && item.name) // Filter out invalid results
          
          return NextResponse.json({ results })
        }
      } catch (error: any) {
        console.log('Finnhub search failed:', error?.message || 'Unknown error')
        // Fall through to return empty results
      }
    }

    // Return empty results if Finnhub fails or no API key
    return NextResponse.json({ results: [] })
  } catch (error: any) {
    console.error('Search API error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
