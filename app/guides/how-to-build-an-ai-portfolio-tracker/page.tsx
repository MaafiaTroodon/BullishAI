'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'
import Link from 'next/link'

export default function HowToBuildAIPortfolioTracker() {
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
              Development
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">How to Build an AI Portfolio Tracker</h1>
            <p className="text-xl text-slate-300">Step-by-step guide to creating your own portfolio tracking application using BullishAI's API and AI insights.</p>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={0.1}>
          <div className="relative h-64 md:h-96 rounded-xl overflow-hidden mb-8">
            <Image
              src="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&q=80"
              alt="AI Portfolio Tracker"
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
        </Reveal>

        <div className="prose prose-invert max-w-none">
          <Reveal variant="fade" delay={0.2}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Introduction</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Building an AI-powered portfolio tracker allows you to monitor your investments in real-time with intelligent insights. This guide will walk you through creating a complete portfolio tracking application using BullishAI's API.
              </p>
              <p className="text-slate-300 leading-relaxed">
                You'll learn how to integrate real-time stock data, implement AI-powered analysis, set up automated alerts, and create an intuitive dashboard for tracking your portfolio performance.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.3}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Prerequisites</h2>
              <ul className="text-slate-300 space-y-2 list-disc list-inside">
                <li>Basic knowledge of JavaScript/TypeScript</li>
                <li>Familiarity with React or Next.js</li>
                <li>BullishAI API access (free tier available)</li>
                <li>Node.js and npm installed</li>
              </ul>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.4}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Step 1: Set Up Your Project</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Start by creating a new Next.js project and installing the necessary dependencies. Set up your API client to connect to BullishAI's endpoints for real-time market data.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Configure environment variables for your API keys and set up authentication to securely access your portfolio data.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.5}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Step 2: Integrate Real-Time Data</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Use BullishAI's quote and chart APIs to fetch live stock prices and historical data. Implement polling mechanisms to keep your portfolio values updated in real-time during market hours.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Handle market sessions (pre-market, regular hours, after-hours) to provide accurate data availability indicators to your users.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.6}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Step 3: Add AI-Powered Insights</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Integrate BullishAI's AI chat endpoint to provide intelligent explanations of market movements, portfolio analysis, and investment recommendations.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Display AI-generated insights alongside your portfolio data to help users understand their investment performance and make informed decisions.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.7}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-4">Step 4: Implement Alerts</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Set up price alerts using BullishAI's alert system. Allow users to create custom alerts for price thresholds, percentage changes, and other market conditions.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Configure webhook endpoints to receive real-time notifications when alert conditions are met, keeping users informed about important market movements.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

