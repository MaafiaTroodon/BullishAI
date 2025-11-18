import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const FINNHUB_KEY = process.env.FINNHUB_API_KEY
let cachedTickerMap: Array<{ symbol: string; aliases: string }> | null = null

async function loadTickerMap() {
  if (cachedTickerMap) return cachedTickerMap
  try {
    const filePath = path.join(process.cwd(), 'bot', 'ticker_map.csv')
    const csv = await fs.readFile(filePath, 'utf-8')
    const lines = csv.split('\n').filter(Boolean).slice(1) // skip header
    cachedTickerMap = lines.map((line) => {
      const [symbol, ...aliasParts] = line.split(',')
      const aliases = aliasParts.join(',') || ''
      return {
        symbol: (symbol || '').trim(),
        aliases: (aliases || '').trim().toLowerCase(),
      }
    }).filter((entry) => entry.symbol)
  } catch (err) {
    console.warn('Failed to load ticker_map.csv fallback:', err instanceof Error ? err.message : err)
    cachedTickerMap = []
  }
  return cachedTickerMap
}

function fallbackSearchLocal(query: string, map: Array<{ symbol: string; aliases: string }>) {
  const q = query.toLowerCase()
  const results = map
    .filter((entry) => entry.symbol.toLowerCase().includes(q) || entry.aliases.includes(q))
    .slice(0, 10)
    .map((entry) => ({
      symbol: entry.symbol,
      name: entry.aliases.split(' ')[0] || entry.symbol,
      displaySymbol: entry.symbol,
      type: 'equity',
    }))
  return results
}

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

    // Fallback to local ticker map if no API key or Finnhub failed
    const map = await loadTickerMap()
    const localResults = fallbackSearchLocal(query, map)
    return NextResponse.json({ results: localResults })
  } catch (error: any) {
    console.error('Search API error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
