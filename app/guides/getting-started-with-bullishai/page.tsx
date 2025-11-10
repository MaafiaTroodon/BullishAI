'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'
import Link from 'next/link'

export default function GettingStartedWithBullishAI() {
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
            <span className="inline-block px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-semibold rounded-full mb-4">
              Featured
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Getting Started with BullishAI</h1>
            <p className="text-xl text-slate-300">New to BullishAI? This comprehensive guide will walk you through setting up your account, adding your first positions, and using our AI-powered features.</p>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={0.1}>
          <div className="relative h-64 md:h-96 rounded-xl overflow-hidden mb-8">
            <Image
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80"
              alt="Getting Started"
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
        </Reveal>

        <div className="prose prose-invert max-w-none">
          <Reveal variant="fade" delay={0.2}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Creating Your Account</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Start by signing up for a free BullishAI account. Click "Get Started" on the homepage and provide your email address. You'll receive a verification email to activate your account.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Once verified, you can access the dashboard where you'll manage your portfolio, set up alerts, and explore AI-powered insights.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.3}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Adding Your First Positions</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Navigate to the Dashboard and click "Add Position" to start building your portfolio. Enter the stock symbol, number of shares, and average purchase price.
              </p>
              <p className="text-slate-300 leading-relaxed">
                You can add multiple positions for the same stock if you've purchased shares at different prices. BullishAI automatically calculates your cost basis and tracks your portfolio value in real-time.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.4}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Understanding the Dashboard</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                The dashboard provides a comprehensive view of your portfolio. The Portfolio Summary shows your total portfolio value, cost basis, returns, and number of holdings.
              </p>
              <p className="text-slate-300 leading-relaxed">
                The Portfolio Chart displays your portfolio value over time, helping you visualize performance. The Holdings section lists all your positions with real-time prices and gains/losses.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.5}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Using AI-Powered Features</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                BullishAI's AI chat feature provides intelligent explanations of market movements and portfolio performance. Ask questions about your holdings, market trends, or investment strategies.
              </p>
              <p className="text-slate-300 leading-relaxed">
                The AI Insights section offers automated analysis of your portfolio, including risk assessment, diversification recommendations, and performance explanations.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.6}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-4">Setting Up Alerts</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Create price alerts to stay informed about important market movements. Go to the Alerts section and set up notifications for price targets, percentage changes, or other conditions.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Configure your notification preferences to receive alerts via email or in-app notifications. Alerts help you stay on top of your investments without constant monitoring.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

