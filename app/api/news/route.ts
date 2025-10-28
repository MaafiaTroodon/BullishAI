import { NextRequest, NextResponse } from 'next/server'
import { getMultiSourceNews } from '@/lib/news-multi-source'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const newsSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol') || 'MARKET'

    // Handle MARKET keyword for general market news
    if (symbol === 'MARKET') {
      const generalNews = await fetchTopMarketNews()
      return NextResponse.json({
        articles: generalNews,
        news: generalNews,
      })
    }

    // Validate input for specific symbol
    const validation = newsSchema.safeParse({ symbol })
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      )
    }

    try {
      const news = await getMultiSourceNews(validation.data.symbol)

      return NextResponse.json({
        articles: news,
        news: news,
        symbol: validation.data.symbol,
        items: news,
      })
    } catch (error: any) {
      console.error('News fetch failed:', error.message)
      return NextResponse.json({
        articles: [],
        news: [],
        symbol: validation.data.symbol,
        items: [],
      })
    }
  } catch (error: any) {
    console.error('News API error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Fetch top market news from multiple sources
async function fetchTopMarketNews() {
  const FINNHUB_KEY = process.env.FINNHUB_API_KEY
  
  try {
    const newsPromises = []
    
    // Fetch from Finnhub general news
    if (FINNHUB_KEY) {
      newsPromises.push(
        fetch(
          `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`,
          { timeout: 5000 }
        ).then(r => r.json()).catch(() => [])
      )
    }

    // Fetch from major stocks (AAPL, MSFT, GOOGL, TSLA, NVDA)
    const majorStocks = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']
    for (const stock of majorStocks) {
      newsPromises.push(getMultiSourceNews(stock).catch(() => []))
    }

    const results = await Promise.allSettled(newsPromises)
    const allNews: any[] = []

    results.forEach((result) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        allNews.push(...result.value)
      }
    })

    // Remove duplicates and sort by date
    const uniqueNews = allNews.filter((item, index, self) =>
      index === self.findIndex((t) => t.title === item.title || t.headline === item.headline)
    )

    // Sort by publishedAt descending
    uniqueNews.sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.datetime || 0).getTime()
      const dateB = new Date(b.publishedAt || b.datetime || 0).getTime()
      return dateB - dateA
    })

    return uniqueNews.slice(0, 50) // Return top 50 news items
  } catch (error: any) {
    console.error('Failed to fetch top market news:', error.message)
    return []
  }
}
