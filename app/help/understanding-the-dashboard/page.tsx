'use client'

import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'

export default function UnderstandingTheDashboard() {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Reveal variant="fade">
          <Link href="/help" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
            ← Back to Help Center
          </Link>
        </Reveal>
        <Reveal variant="rise">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-8">Understanding the Dashboard</h1>
        </Reveal>
        <Reveal variant="fade" delay={0.2}>
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
            <p className="text-slate-300 leading-relaxed mb-4">
              The Dashboard provides a comprehensive view of your portfolio. The Portfolio Summary shows total value, cost basis, returns, and number of holdings. The Portfolio Chart displays value over time.
            </p>
            <p className="text-slate-300 leading-relaxed">
              The Holdings section lists all positions with real-time prices, gains/losses, and return percentages. Use the dashboard to monitor performance and make informed investment decisions.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

