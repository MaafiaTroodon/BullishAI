'use client'

import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'

export default function CreatingPriceAlerts() {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Reveal variant="fade">
          <Link href="/help" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
            ← Back to Help Center
          </Link>
        </Reveal>
        <Reveal variant="rise">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-8">Creating Price Alerts</h1>
        </Reveal>
        <Reveal variant="fade" delay={0.2}>
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
            <p className="text-slate-300 leading-relaxed mb-4">
              Go to the Alerts section and click "Create Alert". Select the stock symbol, enter your target price, and choose whether to alert when price goes above or below the target.
            </p>
            <p className="text-slate-300 leading-relaxed">
              Configure notification methods (email or in-app) and set alert conditions. You can create multiple alerts for the same stock at different price levels to track various scenarios.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

