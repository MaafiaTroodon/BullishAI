import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY
const NEWS_API_KEY = process.env.NEXT_PUBLIC_NEWSAPI_KEY

interface StockData {
  symbol?: string
  price?: number
  change?: number
  changePct?: number
  high?: number
  low?: number
  volume?: number
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const lowerQuery = query.toLowerCase()

    // Check if query is asking about a specific stock
    const stockSymbolMatch = extractStockSymbol(query, lowerQuery)
    
    let stockData: StockData | null = null
    let response = ""

    if (stockSymbolMatch) {
      // Fetch live stock data
      const data = await fetchStockData(stockSymbolMatch)
      
      if (data) {
        stockData = data
        const isPositive = (data.changePct || 0) >= 0
        const arrow = isPositive ? '↑' : '↓'
        
        // One-line summary
        response = `**${stockSymbolMatch} — $${data.price?.toFixed(2) || 'N/A'} (${isPositive ? '+' : ''}${data.changePct?.toFixed(2) || '0.00'}%)** ${arrow}\n\n`
        
        // Compact bullet list
        response += `**Key Stats:**\n`
        if (data.high && data.low) {
          response += `• Day Range: $${data.low.toFixed(2)} - $${data.high.toFixed(2)}\n`
        }
        if (data.volume) {
          response += `• Volume: ${formatVolume(data.volume)}\n`
        }
        
        // Add brief analysis
        if (Math.abs(data.changePct || 0) > 3) {
          response += `\n*Significant ${isPositive ? 'rally' : 'pullback'} — check recent news for catalysts.*\n`
        } else if (Math.abs(data.changePct || 0) > 1) {
          response += `\n*${isPositive ? 'Moderate' : 'Light'} ${isPositive ? 'momentum' : 'pressure'} — normal market activity.*\n`
        }

        // Add buy/sell insight (without advice)
        if (lowerQuery.includes('buy') || lowerQuery.includes('sell') || lowerQuery.includes('should i')) {
          response += `\n**Market Position:**\n`
          if (isPositive && Math.abs(data.changePct || 0) > 2) {
            response += `• Trading with strong momentum — consider risk management\n`
          } else if (!isPositive && Math.abs(data.changePct || 0) > 2) {
            response += `• Near-term volatility — monitor support levels\n`
          } else {
            response += `• Stable trading pattern — assess fundamentals\n`
          }
          response += `*Note: This is market information only, not investment advice.*\n`
        }
        
        // Timestamp
        const now = new Date()
        response += `\n*Updated: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Source: Live market data*`
        
        // Next steps
        response += `\n\n💡 *Want 5-day chart, recent headlines, or fundamentals?*`
      } else {
        response = `Unable to fetch live data for ${stockSymbolMatch}. Verify the ticker or try: MSFT, NVDA, TSLA, GOOGL.`
      }
    } else if (lowerQuery.includes('trending') || lowerQuery.includes('popular')) {
      response = `**Trending Tech & AI Stocks** (as of ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}):\n\n`
      const trendingStocks = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMD']
      
      for (const symbol of trendingStocks) {
        const data = await fetchStockData(symbol)
        if (data && data.price) {
          const change = data.changePct && data.changePct >= 0 ? '+' : ''
          response += `• **${symbol}**: $${data.price.toFixed(2)} (${change}${data.changePct?.toFixed(2) || '0.00'}%)\n`
        }
      }
      response += `\n*Want details on any? Just ask.*`
    } else if (lowerQuery.includes('news') || lowerQuery.includes('update')) {
      const symbolMatch = query.match(/\b[A-Z]{1,5}\b/g)?.[0]
      if (symbolMatch) {
        response = await getStockNews(symbolMatch)
      } else {
        response = `**Latest Headlines:**\n\nSpecify a ticker like 'AAPL news' or 'TSLA updates' for targeted news.`
      }
    } else if (lowerQuery.includes('buy') || lowerQuery.includes('sell') || lowerQuery.includes('should i invest')) {
      response = `**Market Analysis Available:**\n\nI provide market information and data, not personalized advice. Ask me about:\n• Current prices and trends\n• Fundamental metrics (P/E, EPS, revenue)\n• Recent news and catalysts\n• Sector comparisons\n\n*Always consult a qualified financial advisor for investment decisions.*`
    } else if (lowerQuery.includes('help')) {
      response = `**BullishAI Market Analyst** — I track stocks, ETFs, indices, and market data.\n\n**Ask me:**\n• "AAPL price" or "Apple stock"\n• "NVDA news" or "show Tesla news"\n• "MSFT fundamentals" or "what's trending"\n• "Is GOOGL overbought?" or market analysis\n\n**Out of scope:** Politics, health, non-finance topics.\n\n*Always reference live data with timestamps.*`
    } else {
      // Generic response
      response = `I'm BullishAI — focused on stocks and markets only.\n\nTry: "AAPL price", "TSLA news", "trending stocks", or ask about any ticker.\n\n*Ticker symbols help me give you precise, live data.*`
    }

    return NextResponse.json({
      response,
      stockData,
    })
  } catch (error: any) {
    console.error('AI Chat API error:', error)
    return NextResponse.json({
      response: "System temporarily unavailable. Try again in a moment or ask about a different stock.",
      error: error.message,
    }, { status: 500 })
  }
}

function extractStockSymbol(query: string, lowerQuery: string): string | null {
  // Match common stock ticker patterns
  const tickerPattern = /\b[A-Z]{1,5}\b/g
  const tickers = query.match(tickerPattern)
  
  if (!tickers) return null

  // Common words to ignore
  const ignoreWords = ['AI', 'BY', 'TO', 'IT', 'AT', 'THE', 'YOU', 'ME', 'IS', 'AM', 'MY', 'US', 'AS', 'OR', 'ON']
  
  for (const ticker of tickers) {
    if (ticker.length >= 1 && ticker.length <= 5 && !ignoreWords.includes(ticker)) {
      // If the word appears after keywords like "price", "stock", etc.
      if (lowerQuery.includes(`${ticker.toLowerCase()} price`) || 
          lowerQuery.includes(`${ticker.toLowerCase()} stock`) ||
          lowerQuery.includes(`${ticker.toLowerCase()} quote`) ||
          lowerQuery.includes(`what is ${ticker.toLowerCase()}`) ||
          lowerQuery.includes(`tell me about ${ticker.toLowerCase()}`)) {
        return ticker
      }
      
      // If it's a standalone capital letters query
      if (ticker.length === tickers.length && ticker.length <= 5 && ticker.length >= 1) {
        return ticker
      }
    }
  }

  return tickers[0] || null
}

async function fetchStockData(symbol: string): Promise<StockData | null> {
  try {
    // Try Finnhub first
    if (FINNHUB_KEY) {
      const response = await axios.get(`https://finnhub.io/api/v1/quote`, {
        params: { symbol, token: FINNHUB_KEY },
      })

      if (response.data && response.data.c !== null) {
        const change = response.data.c - response.data.pc
        const changePct = ((response.data.c - response.data.pc) / response.data.pc) * 100

        return {
          symbol,
          price: response.data.c,
          change,
          changePct,
          high: response.data.h,
          low: response.data.l,
          volume: response.data.v,
        }
      }
    }

    // Fallback to Yahoo Finance
    const yahooResponse = await axios.get(`https://query1.finance.yahoo.com/v7/finance/quote`, {
      params: {
        symbols: symbol,
      },
    })

    const quote = yahooResponse.data?.quoteResponse?.result?.[0]
    if (quote) {
      return {
        symbol,
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePct: quote.regularMarketChangePercent,
        high: quote.regularMarketDayHigh,
        low: quote.regularMarketDayLow,
        volume: quote.regularMarketVolume,
      }
    }

    return null
  } catch (error) {
    console.error(`Failed to fetch stock data for ${symbol}:`, error)
    return null
  }
}

async function getStockNews(symbol: string): Promise<string> {
  try {
    // Try NewsAPI
    if (NEWS_API_KEY) {
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: symbol,
          apiKey: NEWS_API_KEY,
          sortBy: 'publishedAt',
          pageSize: 3,
        },
      })

      if (response.data.articles && response.data.articles.length > 0) {
        let news = `Latest news for ${symbol}:\n\n`
        response.data.articles.slice(0, 2).forEach((article: any) => {
          news += `• ${article.title}\n`
        })
        return news
      }
    }

    return `No recent news found for ${symbol}. I'm actively checking multiple sources.`
  } catch (error) {
    return `Unable to fetch news for ${symbol} at the moment. Please try again later.`
  }
}

async function getMarketOverview(): Promise<string> {
  const majorStocks = ['SPY', 'QQQ', 'DIA']
  let overview = "Market Overview:\n\n"
  
  for (const symbol of majorStocks) {
    const data = await fetchStockData(symbol)
    if (data) {
      overview += `${symbol}: $${data.price?.toFixed(2) || 'N/A'} (${data.changePct && data.changePct >= 0 ? '+' : ''}${data.changePct?.toFixed(2) || '0.00'}%)\n`
    }
  }
  
  return overview || "Unable to fetch market overview at this time."
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`
  } else if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`
  } else if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`
  }
  return volume.toFixed(0)
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

