import { NextRequest, NextResponse } from 'next/server'
import { getMultiSourceNews } from '@/lib/news-multi-source'
import { z } from 'zod'
import { Groq } from 'groq-sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Cache for 1 hour

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

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

// Fetch top market news from multiple sources and use Groq to curate the best ones
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

    // Fetch from major stocks (AAPL, MSFT, GOOGL, TSLA, NVDA, AMD, META, JPM, BAC)
    const majorStocks = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMD', 'META', 'JPM', 'BAC']
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
      index === self.findIndex((t) => (t.title === item.title || t.headline === item.headline))
    )

    // Sort by publishedAt descending
    uniqueNews.sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.datetime || 0).getTime()
      const dateB = new Date(b.publishedAt || b.datetime || 0).getTime()
      return dateB - dateA
    })

    // Take top 100 for Groq to analyze
    const topNews = uniqueNews.slice(0, 100)

    // Use Groq to intelligently curate the most important news
    const curatedNews = await curateNewsWithGroq(topNews)

    return curatedNews
  } catch (error: any) {
    console.error('Failed to fetch top market news:', error.message)
    return []
  }
}

// Use Groq's Llama-3 to intelligently select and rank the best news
async function curateNewsWithGroq(newsItems: any[]) {
  try {
    // Prepare news for Groq analysis
    const newsSummaries = newsItems.slice(0, 50).map((item, index) => ({
      id: index,
      title: item.title || item.headline || 'No title',
      summary: item.summary || 'No summary',
      source: item.source?.name || item.source || 'Unknown',
      publishedAt: item.publishedAt || item.datetime,
    }))

    const prompt = `You are a financial news curator for a stock market platform called BullishAI.

I'm giving you ${newsSummaries.length} market news articles from today. Your task is to select the TOP 20 most important and impactful news items that investors should be aware of.

Selection criteria:
1. Market-moving impact (earnings, mergers, major announcements)
2. Breaking news and recent developments (less than 24 hours old)
3. Relevance to major stocks (AAPL, MSFT, GOOGL, TSLA, NVDA, etc.)
4. Strategic importance for investors
5. News from credible sources (CNBC, Bloomberg, Reuters, Wall Street Journal)
6. Economic indicators and Fed policy news

Return ONLY a JSON array of the IDs (numbers) of the top 20 most important news items in order of importance.

Example format:
[0, 3, 7, 12, 15, 18, 22, 25, 28, 30, 33, 36, 39, 42, 45, 48, 49, 50, 52, 55]

Do not include explanations, just the JSON array.`

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a financial news analyst. Return only JSON arrays with no explanations.',
        },
        {
          role: 'user',
          content: `${prompt}\n\nNews articles:\n${JSON.stringify(newsSummaries, null, 2)}`,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 500,
    })

    const content = completion.choices[0]?.message?.content?.trim()
    
    // Parse the JSON array from response
    let selectedIds: number[] = []
    try {
      const jsonMatch = content?.match(/\[[\d\s,\]]+\]/)
      if (jsonMatch) {
        selectedIds = JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      console.error('Failed to parse Groq response:', parseError)
    }

    // If Groq selection failed or returned invalid IDs, fall back to top 20 by recency
    if (!selectedIds || selectedIds.length === 0) {
      return newsItems.slice(0, 20)
    }

    // Return the curated news in the order Groq selected
    const curatedNews = selectedIds
      .filter((id) => id >= 0 && id < newsItems.length)
      .map((id) => newsItems[id])
      .filter((item) => item) // Remove any undefined items

    // If we got fewer than 20 items, pad with remaining top news
    if (curatedNews.length < 20) {
      const remainingIds = newsItems
        .map((_, idx) => idx)
        .filter((id) => !selectedIds.includes(id))
        .slice(0, 20 - curatedNews.length)

      const paddingNews = remainingIds.map((id) => newsItems[id])
      return [...curatedNews, ...paddingNews].slice(0, 20)
    }

    return curatedNews
  } catch (error: any) {
    console.error('Groq curation failed:', error.message)
    // Fallback to top 20 by recency
    return newsItems.slice(0, 20)
  }
}
