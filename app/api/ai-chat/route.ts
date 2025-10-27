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
        const trend = data.changePct && data.changePct >= 0 ? 'up' : 'down'
        response = `${stockSymbolMatch} is currently trading at $${data.price?.toFixed(2) || 'N/A'}, ${trend} ${Math.abs(data.changePct || 0).toFixed(2)}% from the previous close. `
        
        if (data.high && data.low) {
          response += `Today's range: $${data.low.toFixed(2)} - $${data.high.toFixed(2)}. `
        }
        
        if (data.volume) {
          response += `Volume: ${formatVolume(data.volume)}. `
        }

        // Add market sentiment
        if (Math.abs(data.changePct || 0) > 3) {
          response += "Significant price movement detected - check recent news for catalysts."
        } else if (Math.abs(data.changePct || 0) > 1) {
          response += "Moderate activity - normal market movement."
        }
      } else {
        response = `I couldn't find live data for ${stockSymbolMatch}. Please verify the ticker symbol or try asking about a different stock.`
      }
    } else if (lowerQuery.includes('trending') || lowerQuery.includes('popular') || lowerQuery.includes('ai stocks')) {
      response = "Based on current market activity, here are some trending AI and tech stocks:"
      const trendingStocks = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMD']
      
      for (const symbol of trendingStocks.slice(0, 3)) {
        const data = await fetchStockData(symbol)
        if (data) {
          response += ` ${symbol} is at $${data.price?.toFixed(2) || 'N/A'} (${data.changePct && data.changePct >= 0 ? '+' : ''}${data.changePct?.toFixed(2) || '0.00'}%).`
        }
      }
    } else if (lowerQuery.includes('news') || lowerQuery.includes('update')) {
      const symbolMatch = query.match(/\b[A-Z]{1,5}\b/g)?.[0]
      if (symbolMatch) {
        response = await getStockNews(symbolMatch)
      } else {
        response = "I can fetch the latest news for a stock. Please mention a ticker symbol, like 'AAPL news' or 'TSLA updates'."
      }
    } else if (lowerQuery.includes('help') || lowerQuery.includes('what can you do')) {
      response = "I'm your AI market analyst! I can help you with:\n\n• Live stock prices and data (e.g., 'AAPL price')\n• Market trends and analysis\n• Company information and metrics\n• News summaries for specific stocks\n• Investment insights and guidance\n\nJust ask me about any stock or market topic!"
    } else if (lowerQuery.includes('market') || lowerQuery.includes('overview')) {
      response = await getMarketOverview()
    } else {
      // Generic response for non-stock questions
      if (lowerQuery.includes('weather') || lowerQuery.includes('food') || lowerQuery.includes('joke')) {
        response = "I'm trained only for market and finance topics — try asking about a company, stock, or sector."
      } else {
        response = "I'm here to help with stock-related questions! Try asking about a specific company, stock, sector, or market trend. For example: 'What's the current price of AAPL?' or 'Tell me about NVDA trends.'"
      }
    }

    return NextResponse.json({
      response,
      stockData,
    })
  } catch (error: any) {
    console.error('AI Chat API error:', error)
    return NextResponse.json({
      response: "I'm having trouble processing that request right now. Please try again or ask about a different stock.",
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

