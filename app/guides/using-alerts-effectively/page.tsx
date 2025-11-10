'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'
import Link from 'next/link'

export default function UsingAlertsEffectively() {
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
              Tutorial
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Using Alerts Effectively</h1>
            <p className="text-xl text-slate-300">Master price alerts to stay informed about market movements and never miss important trading opportunities.</p>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={0.1}>
          <div className="relative h-64 md:h-96 rounded-xl overflow-hidden mb-8">
            <Image
              src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80"
              alt="Price Alerts"
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
        </Reveal>

        <div className="prose prose-invert max-w-none">
          <Reveal variant="fade" delay={0.2}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Understanding Price Alerts</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Price alerts are automated notifications that trigger when a stock reaches a specific price threshold. They help you monitor your investments without constantly checking the market.
              </p>
              <p className="text-slate-300 leading-relaxed">
                BullishAI supports multiple alert types including price targets, percentage changes, and volume-based alerts. Each alert can be customized to match your trading strategy.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.3}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Setting Up Your First Alert</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Navigate to the Alerts section in your dashboard and click "Create Alert". Choose the stock symbol, set your target price, and select the condition (above or below).
              </p>
              <p className="text-slate-300 leading-relaxed">
                Configure notification preferences to receive alerts via email, in-app notifications, or both. You can also set up multiple alerts for the same stock at different price points.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.4}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Advanced Alert Strategies</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Use percentage-based alerts to track significant price movements. For example, set an alert for a 5% gain or loss to catch major market shifts.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Combine multiple alerts to create a comprehensive monitoring system. Set alerts for entry points, profit targets, and stop-loss levels to automate your trading strategy.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.5}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-4">Best Practices</h2>
              <ul className="text-slate-300 space-y-2 list-disc list-inside">
                <li>Set realistic price targets based on technical analysis</li>
                <li>Review and update alerts regularly as market conditions change</li>
                <li>Use alerts to complement, not replace, your research</li>
                <li>Test alert functionality with small price movements first</li>
                <li>Keep alert notifications manageable to avoid alert fatigue</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

