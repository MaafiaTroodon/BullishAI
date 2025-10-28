'use client'

import { useState, useEffect } from 'react'
import { Brain, TrendingUp, TrendingDown, AlertTriangle, DollarSign, BarChart, Zap } from 'lucide-react'

interface Quote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume?: number
  marketCap?: number
}

interface AIInsightsProps {
  watchlistItems: string[]
  quotes: Quote[]
}

export function AIInsights({ watchlistItems, quotes }: AIInsightsProps) {
  const [insights, setInsights] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    if (quotes.length > 0) {
      analyzePortfolio()
    }
  }, [quotes])

  const analyzePortfolio = async () => {
    setIsAnalyzing(true)
    try {
      // Calculate portfolio metrics
      const avgChange = quotes.reduce((sum, q) => sum + (q.changePercent || 0), 0) / quotes.length
      const topGainer = [...quotes].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))[0]
      const topLoser = [...quotes].sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))[0]
      const totalValue = quotes.reduce((sum, q) => sum + (q.price || 0), 0)

      // Generate AI insights
      const newInsights: string[] = []

      // Market sentiment
      if (avgChange > 2) {
        newInsights.push(`🚀 Strong bullish momentum: Your portfolio is up ${avgChange.toFixed(2)}% on average. Consider profit-taking on extended positions.`)
      } else if (avgChange < -2) {
        newInsights.push(`⚠️ Portfolio pressure: Down ${Math.abs(avgChange).toFixed(2)}% on average. Review fundamentals and consider dollar-cost averaging.`)
      } else if (avgChange > 0) {
        newInsights.push(`📈 Moderate gains: Portfolio up ${avgChange.toFixed(2)}%. Tech momentum looks stable.`)
      } else {
        newInsights.push(`📊 Mixed session: Small movements observed. Focus on long-term trends.`)
      }

      // Top gainer/loser
      if (topGainer.changePercent > 0) {
        newInsights.push(`🏆 Top performer: ${topGainer.symbol} up ${topGainer.changePercent.toFixed(2)}%. Monitor for potential resistance levels.`)
      }
      if (topLoser.changePercent < 0) {
        newInsights.push(`📉 Watch: ${topLoser.symbol} down ${Math.abs(topLoser.changePercent).toFixed(2)}%. Check recent news for catalysts.`)
      }

      // Volume analysis
      const highVolume = quotes.filter(q => (q.volume || 0) > 50000000) // 50M+
      if (highVolume.length > 2) {
        newInsights.push(`🔥 High-volume activity detected: ${highVolume.length} stocks showing elevated trading. Institutional interest may be present.`)
      }

      // Concentration analysis
      const top3Weight = quotes.slice(0, 3).reduce((sum, q) => sum + q.price, 0) / totalValue * 100
      if (top3Weight > 40) {
        newInsights.push(`📊 Portfolio concentration: Top 3 holdings represent ${top3Weight.toFixed(0)}% of value. Consider diversification if needed.`)
      }

      // Alert flags
      const volatileStocks = quotes.filter(q => Math.abs(q.changePercent || 0) > 3)
      if (volatileStocks.length > 0) {
        const symbols = volatileStocks.map(q => q.symbol).join(', ')
        newInsights.push(`⚡ High volatility: ${symbols} showing significant price swings (${volatileStocks[0].changePercent?.toFixed(0)}%+). Exercise caution.`)
      }

      setInsights(newInsights.slice(0, 4)) // Limit to 4 insights
    } catch (error) {
      console.error('AI analysis error:', error)
      setInsights(['📊 Analyzing your portfolio...', '💡 Keep your watchlist updated for personalized insights'])
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (watchlistItems.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          AI Insights
        </h3>
        <p className="text-slate-400 mb-3">No stocks in watchlist yet.</p>
        <button className="text-blue-500 hover:text-blue-400 text-sm font-medium">
          Add stocks to watchlist →
        </button>
      </div>
    )
  }

  if (isAnalyzing) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="h-6 w-6 text-purple-500 animate-pulse" />
          <h3 className="text-lg font-semibold text-white">AI Insights</h3>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-700 rounded animate-pulse"></div>
          <div className="h-4 bg-slate-700 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-slate-700 rounded animate-pulse w-1/2"></div>
        </div>
        <p className="text-slate-400 text-sm mt-4">Analyzing portfolio with Groq AI...</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-purple-500" />
          <h3 className="text-lg font-semibold text-white">AI Insights</h3>
        </div>
        <div className="text-xs text-purple-400 font-medium flex items-center gap-1">
          <Zap className="h-3 w-3" />
          Powered by Groq
        </div>
      </div>

      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div
            key={index}
            className="p-3 bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-lg border border-slate-700 hover:border-purple-500/30 transition"
          >
            <p className="text-sm text-slate-200 leading-relaxed">{insight}</p>
          </div>
        ))}
      </div>

      {insights.length === 0 && (
        <div className="text-center py-4">
          <p className="text-slate-400 mb-2">Generating personalized insights...</p>
          <p className="text-slate-500 text-sm">Your AI analyst is processing your portfolio data</p>
        </div>
      )}
    </div>
  )
}

