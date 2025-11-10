'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'
import Link from 'next/link'

export default function PortfolioDiversificationStrategies() {
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
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Portfolio Diversification Strategies</h1>
            <p className="text-xl text-slate-300">Learn how to analyze and improve your portfolio diversification using BullishAI's analytics tools.</p>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={0.1}>
          <div className="relative h-64 md:h-96 rounded-xl overflow-hidden mb-8">
            <Image
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80"
              alt="Portfolio Diversification"
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
        </Reveal>

        <div className="prose prose-invert max-w-none">
          <Reveal variant="fade" delay={0.2}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Why Diversification Matters</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Diversification is a risk management strategy that spreads investments across different assets, sectors, and geographic regions. It helps reduce the impact of any single investment's poor performance on your overall portfolio.
              </p>
              <p className="text-slate-300 leading-relaxed">
                A well-diversified portfolio can help you achieve more consistent returns over time while minimizing volatility. BullishAI's analytics tools help you visualize and optimize your diversification.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.3}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Analyzing Your Current Portfolio</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Use BullishAI's portfolio analytics to view your holdings by sector, market cap, and geographic exposure. Identify concentration risks and areas where you may be overexposed.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Review your portfolio's correlation matrix to understand how your holdings move relative to each other. Low correlation between assets indicates better diversification.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.4}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Diversification Strategies</h2>
              <ul className="text-slate-300 space-y-3 list-disc list-inside mb-4">
                <li><strong>Sector Diversification:</strong> Spread investments across technology, healthcare, finance, consumer goods, and other sectors</li>
                <li><strong>Market Cap Diversification:</strong> Balance large-cap, mid-cap, and small-cap stocks</li>
                <li><strong>Geographic Diversification:</strong> Include international stocks to reduce country-specific risks</li>
                <li><strong>Asset Class Diversification:</strong> Consider bonds, ETFs, and alternative investments</li>
              </ul>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.5}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-4">Using BullishAI Tools</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Leverage BullishAI's portfolio insights to get AI-powered recommendations for improving diversification. The platform analyzes your current holdings and suggests adjustments based on your risk tolerance.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Set up alerts for sector concentration warnings and use the portfolio analytics dashboard to track your diversification metrics over time.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

