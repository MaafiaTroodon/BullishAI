'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'
import Link from 'next/link'

export default function MaximizingPortfolioReturns() {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Reveal variant="fade">
          <Link href="/guides" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
            ← Back to Guides
          </Link>
        </Reveal>

        <Reveal variant="rise">
          <div className="mb-8">
            <span className="inline-block px-3 py-1 bg-purple-600/20 text-purple-400 text-xs font-semibold rounded-full mb-4">
              Investing
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Maximizing Portfolio Returns</h1>
            <p className="text-xl text-slate-300">Advanced strategies for optimizing your portfolio performance using AI-powered insights and analytics.</p>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={0.1}>
          <div className="relative h-64 md:h-96 rounded-xl overflow-hidden mb-8">
            <Image
              src="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&q=80"
              alt="Portfolio Returns"
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
        </Reveal>

        <div className="prose prose-invert max-w-none">
          <Reveal variant="fade" delay={0.2}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Strategic Asset Allocation</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Use BullishAI's portfolio analytics to identify optimal asset allocation based on your risk tolerance and investment goals. The platform provides AI-powered recommendations for rebalancing.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Regularly review and adjust your allocation to maintain your target risk-return profile. Consider market conditions and economic cycles when making allocation decisions.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.3}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Using AI Insights</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Leverage BullishAI's AI-powered analysis to understand market trends, identify opportunities, and assess risk. The AI provides explanations for portfolio performance and suggests optimization strategies.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Use AI insights to complement your research, not replace it. Combine AI recommendations with fundamental and technical analysis for well-informed decisions.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.4}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Tax-Efficient Strategies</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Implement tax-loss harvesting strategies using BullishAI's portfolio tracking. Identify opportunities to offset gains with losses while maintaining your investment strategy.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Consider holding periods for long-term capital gains treatment and use BullishAI's transaction history to track cost basis and holding periods accurately.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.5}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-4">Continuous Monitoring</h2>
              <ul className="text-slate-300 space-y-2 list-disc list-inside">
                <li>Set up alerts for significant portfolio changes</li>
                <li>Review performance metrics regularly using BullishAI's dashboard</li>
                <li>Track your portfolio's correlation with market indices</li>
                <li>Monitor individual holding performance and rebalance as needed</li>
                <li>Use historical performance data to refine your strategy</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

