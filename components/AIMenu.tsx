'use client'

import Link from 'next/link'
import { 
  Zap, 
  TrendingUp, 
  BarChart3, 
  HelpCircle, 
  Search, 
  Star,
  DollarSign,
  Target,
  Shield,
  Activity
} from 'lucide-react'
import { Reveal } from './anim/Reveal'

const aiFeatures = [
  {
    id: 'quick-insights',
    title: 'Quick Insights',
    description: 'One-paragraph market snapshot + 3 tickers to watch',
    icon: Zap,
    href: '/ai/quick-insights',
    color: 'blue',
  },
  {
    id: 'recommended',
    title: "Today's Recommended Stocks",
    description: '5–10 names with reason tags (upgrade, breakout, volume)',
    icon: Star,
    href: '/ai/recommended',
    color: 'purple',
  },
  {
    id: 'technical',
    title: 'Technical Analysis',
    description: 'Per-ticker: trend, SR levels, patterns, momentum score',
    icon: BarChart3,
    href: '/ai/technical',
    color: 'green',
  },
  {
    id: 'should-buy',
    title: 'Should I Buy?',
    description: 'Per-ticker verdict: thesis, entry/exit, risks',
    icon: HelpCircle,
    href: '/ai/should-buy',
    color: 'yellow',
  },
  {
    id: 'research',
    title: 'Stock Research',
    description: 'Company card: snapshot, financials, catalysts, filings',
    icon: Search,
    href: '/ai/research',
    color: 'pink',
  },
  {
    id: 'top-picks',
    title: 'Top Stock Picks',
    description: 'Weekly list by theme (Value, Quality, Momentum, Dividend)',
    icon: TrendingUp,
    href: '/ai/top-picks',
    color: 'indigo',
  },
  {
    id: 'value-quality',
    title: 'Best Value Stocks',
    description: 'High-quality stocks offering the best value this week',
    icon: DollarSign,
    href: '/ai/value',
    color: 'emerald',
  },
  {
    id: 'momentum',
    title: 'Strongest Momentum',
    description: '5 stocks with strongest short-term momentum',
    icon: Activity,
    href: '/ai/momentum',
    color: 'orange',
  },
  {
    id: 'undervalued',
    title: 'Undervalued Rebound',
    description: 'Undervalued stocks poised for a rebound',
    icon: Target,
    href: '/ai/rebound',
    color: 'red',
  },
  {
    id: 'strongest-today',
    title: 'Strongest Today',
    description: 'Stocks with strongest relative strength and volume',
    icon: Shield,
    href: '/ai/strongest-today',
    color: 'cyan',
  },
  {
    id: 'stable-growth',
    title: 'Stable Growth Picks',
    description: 'Low beta, consistent EPS stocks for long-term holding',
    icon: TrendingUp,
    href: '/ai/stable-growth',
    color: 'teal',
  },
]

const colorClasses: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:border-blue-500/40',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:border-purple-500/40',
  green: 'bg-green-500/10 text-green-400 border-green-500/20 hover:border-green-500/40',
  yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:border-yellow-500/40',
  pink: 'bg-pink-500/10 text-pink-400 border-pink-500/20 hover:border-pink-500/40',
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:border-indigo-500/40',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:border-orange-500/40',
  red: 'bg-red-500/10 text-red-400 border-red-500/20 hover:border-red-500/40',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:border-cyan-500/40',
  teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20 hover:border-teal-500/40',
}

export function AIMenu() {
  return (
    <div className="min-h-screen bg-slate-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal variant="rise">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">AI-Powered Analysis</h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Get intelligent insights, recommendations, and analysis powered by multiple AI models
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {aiFeatures.map((feature, idx) => {
            const Icon = feature.icon
            return (
              <Reveal key={feature.id} variant="rise" delay={idx * 0.05}>
                <Link href={feature.href}>
                  <div className={`bg-slate-800/50 rounded-xl p-6 border ${colorClasses[feature.color]} transition-all hover:scale-[1.02] cursor-pointer group`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${colorClasses[feature.color]} flex-shrink-0`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </div>

        <Reveal variant="fade" delay={0.6}>
          <div className="mt-12 bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-white">AI Model Information</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Our AI system uses multiple models optimized for different tasks:
            </p>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-400 font-semibold">Groq (Llama-3)</span>
                <p className="text-slate-400">Ultra-low latency for quick insights and recommendations</p>
              </div>
              <div>
                <span className="text-purple-400 font-semibold">Gemini 1.5</span>
                <p className="text-slate-400">Multimodal analysis for PDFs, filings, and documents</p>
              </div>
              <div>
                <span className="text-green-400 font-semibold">Local PyTorch</span>
                <p className="text-slate-400">Fine-tuned model for domain-specific finance Q&A</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-500">
                ⚠️ Not financial advice. All AI responses are for informational purposes only. Always do your own research and consult with a financial advisor.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

