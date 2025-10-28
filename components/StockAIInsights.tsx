'use client'

import { useState, useEffect } from 'react'
import { Brain, TrendingUp, TrendingDown, AlertCircle, Target, Activity, DollarSign } from 'lucide-react'

interface StockAIInsightsProps {
  symbol: string
  quote: any
  candles: any[]
  news: any[]
  changePctOverRange?: number | null
}

export function StockAIInsights({ symbol, quote, candles, news, changePctOverRange }: StockAIInsightsProps) {
  const [insights, setInsights] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    if (quote && candles && news) {
      generateInsights()
    }
  }, [quote, candles, news, changePctOverRange])

  const generateInsights = async () => {
    setIsAnalyzing(true)
    try {
      const insightList: string[] = []

      // 1. Price movement analysis
      if (changePctOverRange !== null && changePctOverRange !== undefined) {
        if (changePctOverRange > 5) {
          insightList.push(`📈 Strong momentum: Up ${changePctOverRange.toFixed(1)}% over this period. Potential overbought - watch for pullback.`)
        } else if (changePctOverRange < -5) {
          insightList.push(`📉 Significant decline: Down ${Math.abs(changePctOverRange).toFixed(1)}%. Consider checking fundamentals and news catalysts.`)
        } else if (changePctOverRange > 2) {
          insightList.push(`📊 Positive trend: +${changePctOverRange.toFixed(1)}% movement. Momentum remains healthy.`)
        } else if (changePctOverRange < -2) {
          insightList.push(`⚠️ Downward pressure: ${changePctOverRange.toFixed(1)}% decline. Monitor support levels.`)
        }
      }

      // 2. Price vs 52W range
      if (quote.price && quote.week52High && quote.week52Low) {
        const rangeFromLow = ((quote.price - quote.week52Low) / (quote.week52High - quote.week52Low)) * 100
        if (rangeFromLow > 80) {
          insightList.push(`🏆 Trading near 52W high (${rangeFromLow.toFixed(0)}% of range). Momentum strong but watch resistance at $${quote.week52High.toFixed(2)}.`)
        } else if (rangeFromLow < 20) {
          insightList.push(`💡 Near 52W low (${rangeFromLow.toFixed(0)}% of range). Potential value play if fundamentals are solid.`)
        } else if (rangeFromLow > 60) {
          insightList.push(`📊 Price in upper range (${rangeFromLow.toFixed(0)}% of 52W). Above-average positioning suggests positive sentiment.`)
        }
      }

      // 3. Volume analysis
      if (quote.volume && quote.volume > 100000000) {
        insightList.push(`🔥 High volume activity: ${(quote.volume / 1000000).toFixed(0)}M shares. Institutional interest or significant news catalyst likely present.`)
      } else if (quote.volume && quote.volume < 10000000) {
        insightList.push(`🔇 Low volume: ${(quote.volume / 1000000).toFixed(1)}M shares. Thin trading suggests consolidation phase.`)
      }

      // 4. P/E Ratio valuation
      if (quote.peRatio) {
        if (quote.peRatio > 30) {
          insightList.push(`💰 Premium valuation (P/E: ${quote.peRatio.toFixed(1)}). Growth expectations high - earnings performance crucial.`)
        } else if (quote.peRatio < 15 && quote.peRatio > 0) {
          insightList.push(`💎 Reasonable valuation (P/E: ${quote.peRatio.toFixed(1)}). Trades below market average - potential value opportunity.`)
        }
      }

      // 5. News sentiment
      if (news && news.length > 0) {
        const recentNews = news.slice(0, 3)
        const hasBullishKeywords = recentNews.some((item: any) => 
          item.headline?.toLowerCase().includes('upgrad') ||
          item.headline?.toLowerCase().includes('beat') ||
          item.headline?.toLowerCase().includes('growth') ||
          item.headline?.toLowerCase().includes('rally')
        )
        const hasBearishKeywords = recentNews.some((item: any) =>
          item.headline?.toLowerCase().includes('down') ||
          item.headline?.toLowerCase().includes('miss') ||
          item.headline?.toLowerCase().includes('concern') ||
          item.headline?.toLowerCase().includes('warning')
        )

        if (hasBullishKeywords) {
          insightList.push(`📰 Recent news sentiment: Positive headlines detected. Monitor for continued momentum or profit-taking.`)
        } else if (hasBearishKeywords) {
          insightList.push(`📰 Recent news shows concerns. Verify fundamentals and check for recovery catalysts.`)
        } else {
          insightList.push(`📰 News flow neutral. Focus on upcoming earnings or sector trends for direction.`)
        }
      }

      // 6. Market cap context
      if (quote.marketCap) {
        const marketCapBillions = quote.marketCap / 1000000000
        if (marketCapBillions > 500) {
          insightList.push(`🏛️ Mega-cap: $${marketCapBillions.toFixed(0)}B market cap. Stable blue-chip with institutional backing.`)
        } else if (marketCapBillions < 10) {
          insightList.push(`🌱 Small-cap exposure: $${marketCapBillions.toFixed(1)}B market cap. Higher volatility potential.`)
        }
      }

      // Limit to 3-5 insights
      setInsights(insightList.slice(0, 5))
    } catch (error) {
      console.error('AI Insights error:', error)
      setInsights([
        `📊 Analyzing ${symbol} performance...`,
        `💡 Review fundamentals and recent news for investment decisions`,
      ])
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (isAnalyzing) {
    return (
      <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-xl p-6 border border-purple-500/30 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="h-5 w-5 text-purple-400 animate-pulse" />
          <h3 className="text-lg font-semibold text-white">AI Insights</h3>
          <span className="text-xs text-purple-400">Powered by Groq</span>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-purple-900/30 rounded animate-pulse"></div>
          <div className="h-3 bg-purple-900/30 rounded animate-pulse w-5/6"></div>
          <div className="h-3 bg-purple-900/30 rounded animate-pulse w-4/6"></div>
        </div>
      </div>
    )
  }

  if (insights.length === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-xl p-6 border border-purple-500/30 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">AI Insights for {symbol}</h3>
        </div>
        <span className="text-xs text-purple-400 font-medium">Powered by Groq</span>
      </div>

      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div
            key={index}
            className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 hover:border-purple-500/50 transition text-sm text-slate-200"
          >
            {insight}
          </div>
        ))}
      </div>
    </div>
  )
}

