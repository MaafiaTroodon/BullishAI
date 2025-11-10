'use client'

import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'

export default function CreatingYourFirstPortfolio() {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Reveal variant="fade">
          <Link href="/help" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
            ← Back to Help Center
          </Link>
        </Reveal>

        <Reveal variant="rise">
          <div className="mb-8">
            <span className="inline-block px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-semibold rounded-full mb-4">
              Getting Started
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Creating Your First Portfolio</h1>
          </div>
        </Reveal>

        <div className="prose prose-invert max-w-none">
          <Reveal variant="fade" delay={0.2}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Getting Started</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Creating your first portfolio in BullishAI is simple. After signing up and logging in, navigate to the Dashboard where you'll see an empty portfolio ready to be populated.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Click the "Add Position" button to start adding your stock holdings. You'll need the stock symbol (e.g., AAPL for Apple), the number of shares, and your average purchase price.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.3}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Adding Your First Position</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                When adding a position, enter the stock symbol in the search field. BullishAI will automatically fetch the current price and company information. Then enter the number of shares you own and your average purchase price.
              </p>
              <p className="text-slate-300 leading-relaxed">
                If you've purchased the same stock at different prices, you can add multiple positions for the same symbol. BullishAI will calculate your total cost basis and average purchase price automatically.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.4}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-4">Viewing Your Portfolio</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Once you've added positions, your portfolio will appear on the Dashboard. You'll see real-time updates of your portfolio value, individual holding performance, and overall returns.
              </p>
              <p className="text-slate-300 leading-relaxed">
                The portfolio chart shows your total portfolio value over time, helping you track performance. Use the Holdings section to view detailed information about each position, including current value, gains/losses, and return percentages.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

