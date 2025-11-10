'use client'

import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'

export default function AlertTypesAndConditions() {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Reveal variant="fade">
          <Link href="/help" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
            ← Back to Help Center
          </Link>
        </Reveal>
        <Reveal variant="rise">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-8">Alert Types and Conditions</h1>
        </Reveal>
        <Reveal variant="fade" delay={0.2}>
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
            <p className="text-slate-300 leading-relaxed mb-4">
              Price alerts can trigger when a stock reaches a specific price (above or below target). Percentage alerts trigger on percentage changes (e.g., 5% gain or loss).
            </p>
            <p className="text-slate-300 leading-relaxed">
              Volume alerts notify you of unusual trading activity. Combine different alert types to create a comprehensive monitoring system for your investments.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

