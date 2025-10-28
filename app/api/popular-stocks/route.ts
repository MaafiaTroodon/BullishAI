import { NextResponse } from 'next/server'
import { Groq } from 'groq-sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 600 // Cache for 10 minutes

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

// Popular stocks for demo (can be replaced with AI-selected stocks)
const DEFAULT_POPULAR_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX'
]

export async function GET() {
  try {
    // Use Groq to select interesting stocks based on current market trends
    const prompt = `You are a stock market analyst. Analyze current market trends and return exactly 8 stock tickers that are:
1. Popular today in the US market
2. Include a mix of tech stocks, ETFs, and other major sectors
3. Have significant trading volume

Return ONLY a JSON array of exactly 8 ticker symbols (uppercase) like this format:
["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "SPY", "QQQ", "NFLX"]

Do not include any explanation or other text, just the JSON array.`

    let stocks
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 200,
      })

      const content = completion.choices[0]?.message?.content?.trim()
      if (content) {
        // Try to parse JSON from the response
        const jsonMatch = content.match(/\[.*?\]/)
        if (jsonMatch) {
          stocks = JSON.parse(jsonMatch[0])
        }
      }
    } catch (error: any) {
      console.error('Groq API error:', error.message)
    }

    // Fallback to default stocks if AI parsing fails
    if (!stocks || !Array.isArray(stocks) || stocks.length !== 8) {
      stocks = DEFAULT_POPULAR_STOCKS
    }

    return NextResponse.json({ stocks })
  } catch (error: any) {
    console.error('Popular stocks API error:', error)
    return NextResponse.json(
      { stocks: DEFAULT_POPULAR_STOCKS },
      { status: 200 }
    )
  }
}

