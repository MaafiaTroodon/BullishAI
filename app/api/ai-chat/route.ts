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
        
        // Get company name if available
        const companyEntry = Object.entries(COMPANY_TO_TICKER).find(([, ticker]) => ticker === stockSymbolMatch)
        const companyName = companyEntry ? companyEntry[0].charAt(0).toUpperCase() + companyEntry[0].slice(1) : null
        
        // One-line summary
        if (companyName) {
          response = `**${companyName} (${stockSymbolMatch}) — $${data.price?.toFixed(2) || 'N/A'} (${isPositive ? '+' : ''}${data.changePct?.toFixed(2) || '0.00'}%)** ${arrow}\n\n`
        } else {
          response = `**${stockSymbolMatch} — $${data.price?.toFixed(2) || 'N/A'} (${isPositive ? '+' : ''}${data.changePct?.toFixed(2) || '0.00'}%)** ${arrow}\n\n`
        }
        
        // Compact bullet list
        response += `**Key Stats:**\n`
        if (data.high && data.low) {
          response += `• Day Range: $${data.low.toFixed(2)} - $${data.high.toFixed(2)}\n`
        }
        if (data.volume) {
          response += `• Volume: ${formatVolume(data.volume)}\n`
        }
        
        // Add brief market analysis
        if (Math.abs(data.changePct || 0) > 3) {
          response += `\n*📊 Significant ${isPositive ? 'rally' : 'pullback'} — check recent news for catalysts.*\n`
        } else if (Math.abs(data.changePct || 0) > 1) {
          response += `\n*📊 ${isPositive ? 'Moderate' : 'Light'} ${isPositive ? 'momentum' : 'pressure'} — normal market activity.*\n`
        } else {
          response += `\n*📊 Trading near previous close — stable session.*\n`
        }

        // Add buy/sell insight (without advice)
        if (lowerQuery.includes('buy') || lowerQuery.includes('sell') || lowerQuery.includes('should i')) {
          response += `\n**Market Analysis:**\n`
          if (isPositive && Math.abs(data.changePct || 0) > 2) {
            response += `• Strong momentum observed — monitor for overbought signals\n`
          } else if (!isPositive && Math.abs(data.changePct || 0) > 2) {
            response += `• Near-term selling pressure — watch support levels\n`
          } else {
            response += `• Stable price action — assess company fundamentals\n`
          }
          response += `\n*⚠️ This is market information only, not investment advice. Always do your own research.*\n`
        }
        
        // Timestamp and source
        const now = new Date()
        response += `\n\n*Updated: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} EST • Source: Live market data*`
        
        // Next steps
        response += `\n\n💡 *Need more? Ask for: 5-day chart, recent headlines, fundamentals, or sector comparison.*`
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

// Company name to ticker mapping
const COMPANY_TO_TICKER: Record<string, string> = {
  'amazon': 'AMZN',
  'apple': 'AAPL',
  'microsoft': 'MSFT',
  'google': 'GOOGL',
  'alphabet': 'GOOGL',
  'meta': 'META',
  'facebook': 'META',
  'tesla': 'TSLA',
  'nvidia': 'NVDA',
  'netflix': 'NFLX',
  'amd': 'AMD',
  'intel': 'INTC',
  'oracle': 'ORCL',
  'ibm': 'IBM',
  'salesforce': 'CRM',
  'paypal': 'PYPL',
  'adobe': 'ADBE',
  'shopify': 'SHOP',
  'uber': 'UBER',
  'lyft': 'LYFT',
  'airbnb': 'ABNB',
  'disney': 'DIS',
  'walmart': 'WMT',
  'costco': 'COST',
  'target': 'TGT',
  'nike': 'NKE',
  'starbucks': 'SBUX',
  'visa': 'V',
  'mastercard': 'MA',
  'american express': 'AXP',
  'jpmorgan': 'JPM',
  'jp morgan': 'JPM',
  'chase': 'JPM',
  'bank of america': 'BAC',
  'bofa': 'BAC',
  'wells fargo': 'WFC',
  'goldman sachs': 'GS',
  'morgan stanley': 'MS',
  'citigroup': 'C',
  'berkshire hathaway': 'BRK.B',
  'johnson & johnson': 'JNJ',
  'pfizer': 'PFE',
  'merck': 'MRK',
  'exxon': 'XOM',
  'exxon mobil': 'XOM',
  'chevron': 'CVX',
  'boeing': 'BA',
  'caterpillar': 'CAT',
  'general motors': 'GM',
  'gm': 'GM',
  'ford': 'F',
  'coca cola': 'KO',
  'coke': 'KO',
  'pepsi': 'PEP',
  'mcdonalds': 'MCD',
  'at&t': 'T',
  'att': 'T',
  'verizon': 'VZ',
  'home depot': 'HD',
  'lowes': 'LOW',
  'samsung': '005930.KS',
  'alibaba': 'BABA',
  'baidu': 'BIDU',
  'tencent': 'TCEHY',
  'shell': 'SHEL',
  'bp': 'BP',
  'total': 'TTE',
  'shell': 'SHEL',
  'morgan stanley': 'MS',
  'duke energy': 'DUK',
  'pg&e': 'PCG',
  'american airlines': 'AAL',
  'delta': 'DAL',
  'united': 'UAL',
  'spotify': 'SPOT',
  'zoom': 'ZM',
  'peloton': 'PTON',
  'snowflake': 'SNOW',
  'datadog': 'DDOG',
  'mongodb': 'MDB',
  'cloudflare': 'NET',
  'splunk': 'SPLK',
  'crowdstrike': 'CRWD',
  'palantir': 'PLTR',
  'rivian': 'RIVN',
  'nio': 'NIO',
  'lucid': 'LCID',
  // Crypto
  'bitcoin': 'BTC-USD',
  'btc': 'BTC-USD',
  'ethereum': 'ETH-USD',
  'eth': 'ETH-USD',
  'cardano': 'ADA-USD',
  'ada': 'ADA-USD',
  'solana': 'SOL-USD',
  'sol': 'SOL-USD',
  'polygon': 'MATIC-USD',
  'matic': 'MATIC-USD',
  'polkadot': 'DOT-USD',
  'dot': 'DOT-USD',
  'litecoin': 'LTC-USD',
  'ltc': 'LTC-USD',
  'ripple': 'XRP-USD',
  'xrp': 'XRP-USD',
  'chainlink': 'LINK-USD',
  'link': 'LINK-USD',
  'avalanche': 'AVAX-USD',
  'avax': 'AVAX-USD',
  'uniswap': 'UNI-USD',
  'uni': 'UNI-USD',
  // More tech
  'qualcomm': 'QCOM',
  'qcom': 'QCOM',
  'broadcom': 'AVGO',
  'avgo': 'AVGO',
  'cisco': 'CSCO',
  'csco': 'CSCO',
  'nvidia': 'NVDA',
  'nvidia corp': 'NVDA',
  // Pharma & Healthcare
  'moderna': 'MRNA',
  'mrna': 'MRNA',
  'gilead': 'GILD',
  'gild': 'GILD',
  'abbvie': 'ABBV',
  'abbv': 'ABBV',
  'bristol myers': 'BMY',
  'bmy': 'BMY',
  'eli lilly': 'LLY',
  'lly': 'LLY',
  // Energy
  'next era': 'NEE',
  'nee': 'NEE',
  'southern co': 'SO',
  'so': 'SO',
  'american electric': 'AEP',
  'aep': 'AEP',
  // Finance
  'blackrock': 'BLK',
  'blk': 'BLK',
  'charles schwab': 'SCHW',
  'schw': 'SCHW',
  'alphabet': 'GOOGL',
  // Industrial
  'deere': 'DE',
  'de': 'DE',
  'honeywell': 'HON',
  'hon': 'HON',
  'ge': 'GE',
  'general electric': 'GE',
  '3m': 'MMM',
  'mmm': 'MMM',
}

function extractStockSymbol(query: string, lowerQuery: string): string | null {
  // First check for company names in the query
  for (const [company, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    if (lowerQuery.includes(company)) {
      return ticker
    }
  }

  // Create a list of all tickers to match
  const allTickers = Object.values(COMPANY_TO_TICKER).concat([
    'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'AMD', 'INTC',
    'IBM', 'ORCL', 'CRM', 'PYPL', 'ADBE', 'SHOP', 'UBER', 'LYFT', 'ABNB', 'DIS', 'WMT',
    'COST', 'TGT', 'NKE', 'SBUX', 'V', 'MA', 'AXP', 'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C',
    'BRK.B', 'UNH', 'JNJ', 'PFE', 'MRK', 'XOM', 'CVX', 'BA', 'CAT', 'GM', 'F', 'KO', 'PEP',
    'MCD', 'T', 'VZ', 'HD', 'LOW', 'BABA', 'BIDU', 'TCEHY', 'SHEL', 'BP', 'TTE'
  ])

  // Check for any ticker symbol (uppercase) in the query
  for (const ticker of allTickers) {
    // Check for ticker in both uppercase and lowercase
    if (query.includes(ticker) || lowerQuery.includes(ticker.toLowerCase())) {
      return ticker
    }
  }

  // Match common stock ticker patterns (uppercase)
  const tickerPattern = /\b[A-Z]{1,5}\b/g
  const tickers = query.match(tickerPattern)
  
  // Also try to extract potential ticker from lowercase (e.g., "tsla" -> "TSLA")
  const lowerTickerPattern = /\b[a-z]{2,5}\b/g
  const lowerTickers = lowerQuery.match(lowerTickerPattern)
  
  if (lowerTickers) {
    for (const ticker of lowerTickers) {
      if (ticker.length >= 2 && ticker.length <= 5) {
        const upperTicker = ticker.toUpperCase()
        // Check if it's a known ticker
        if (allTickers.includes(upperTicker)) {
          return upperTicker
        }
        // Check if it looks like a ticker (all letters, reasonable length)
        if (/^[A-Z]{2,5}$/.test(upperTicker)) {
          return upperTicker
        }
      }
    }
  }
  
  if (!tickers) return null

  // Common words to ignore
  const ignoreWords = ['AI', 'BY', 'TO', 'IT', 'AT', 'THE', 'YOU', 'ME', 'IS', 'AM', 'MY', 'US', 'AS', 'OR', 'ON', 'DO', 'AN', 'IN', 'BE', 'SO', 'WE', 'OF']
  
  for (const ticker of tickers) {
    if (ticker.length >= 2 && ticker.length <= 5 && !ignoreWords.includes(ticker.toUpperCase())) {
      // If the word appears after keywords like "price", "stock", etc.
      if (lowerQuery.includes(`${ticker.toLowerCase()} price`) || 
          lowerQuery.includes(`${ticker.toLowerCase()} stock`) ||
          lowerQuery.includes(`${ticker.toLowerCase()} quote`) ||
          lowerQuery.includes(`what is ${ticker.toLowerCase()}`) ||
          lowerQuery.includes(`tell me about ${ticker.toLowerCase()}`) ||
          lowerQuery.includes(`current ${ticker.toLowerCase()}`) ||
          lowerQuery.includes(`price of ${ticker.toLowerCase()}`)) {
        return ticker
      }
      
      // If it's a standalone capital letters query
      if (ticker.length <= 5 && ticker.length >= 2) {
        return ticker
      }
    }
  }

  return tickers[0] || null
}

async function fetchStockData(symbol: string): Promise<StockData | null> {
  try {
    // Use our existing comprehensive quote API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    
    try {
      const response = await axios.get(`${baseUrl}/api/quote`, {
        params: { symbol },
        timeout: 5000,
      })

      if (response.data && response.data.price) {
        return {
          symbol: response.data.symbol || symbol,
          price: response.data.price,
          change: response.data.change,
          changePct: response.data.changePct,
          high: response.data.high,
          low: response.data.low,
          volume: response.data.volume,
        }
      }
    } catch (apiError) {
      console.error('Quote API failed, trying direct fetch:', apiError)
    }

    // Fallback: Try Finnhub directly
    if (FINNHUB_KEY) {
      const response = await axios.get(`https://finnhub.io/api/v1/quote`, {
        params: { symbol, token: FINNHUB_KEY },
        timeout: 5000,
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

    // Last resort: Yahoo Finance
    try {
      const yahooResponse = await axios.get(`https://query1.finance.yahoo.com/v7/finance/quote`, {
        params: { symbols: symbol },
        timeout: 5000,
      })

      const quote = yahooResponse.data?.quoteResponse?.result?.[0]
      if (quote && quote.regularMarketPrice) {
        return {
          symbol,
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          changePct: (quote.regularMarketChangePercent || 0) * 100,
          high: quote.regularMarketDayHigh,
          low: quote.regularMarketDayLow,
          volume: quote.regularMarketVolume,
        }
      }
    } catch (yahooError) {
      console.error('Yahoo Finance failed:', yahooError)
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

