'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'
import { useState } from 'react'

const helpTopics = [
  {
    title: 'Getting Started',
    icon: '🚀',
    articles: [
      'Creating your first portfolio',
      'Adding positions and transactions',
      'Understanding the dashboard',
      'Setting up price alerts',
    ],
  },
  {
    title: 'Portfolio Management',
    icon: '📊',
    articles: [
      'Tracking portfolio performance',
      'Understanding portfolio metrics',
      'Exporting portfolio data',
      'Managing multiple portfolios',
    ],
  },
  {
    title: 'Alerts & Notifications',
    icon: '🔔',
    articles: [
      'Creating price alerts',
      'Alert types and conditions',
      'Managing notifications',
      'Troubleshooting alerts',
    ],
  },
  {
    title: 'API & Integrations',
    icon: '🔌',
    articles: [
      'Getting your API key',
      'API authentication',
      'Rate limits and best practices',
      'Webhook setup',
    ],
  },
  {
    title: 'Account & Billing',
    icon: '💳',
    articles: [
      'Upgrading your plan',
      'Managing subscriptions',
      'Payment methods',
      'Canceling your account',
    ],
  },
  {
    title: 'Troubleshooting',
    icon: '🔧',
    articles: [
      'Data not updating',
      'Login issues',
      'API errors',
      'Performance problems',
    ],
  },
]

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[40vh] min-h-[300px] overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=80"
            alt="Help Center"
            fill
            className="object-cover opacity-40"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900" />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4 w-full max-w-2xl">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Help Center</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for help articles..."
                    className="w-full px-6 py-4 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg
                    className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Help Topics Grid */}
        <Reveal variant="fade">
          <div className="mb-12">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-8 text-center">Browse by Topic</h2>
            </Reveal>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {helpTopics.map((topic, idx) => (
                <Reveal key={topic.title} variant="rise" delay={idx * 0.05}>
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer">
                    <div className="text-4xl mb-4">{topic.icon}</div>
                    <h3 className="text-xl font-semibold text-white mb-4">{topic.title}</h3>
                    <ul className="space-y-2">
                      {topic.articles.map((article) => (
                        <li key={article} className="flex items-start">
                          <svg
                            className="w-4 h-4 text-blue-400 mr-2 mt-1 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-slate-400 text-sm hover:text-white transition">{article}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Quick Links */}
        <Reveal variant="fade" delay={0.3}>
          <div className="bg-slate-800/50 rounded-2xl p-8 md:p-12 border border-slate-700">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">Still Need Help?</h2>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-6">
              <Reveal variant="rise" delay={0.1}>
                <a
                  href="/contact"
                  className="block bg-slate-700/50 rounded-xl p-6 border border-slate-600 hover:border-blue-500 transition text-center"
                >
                  <svg className="w-8 h-8 text-blue-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-white mb-2">Contact Us</h3>
                  <p className="text-slate-400 text-sm">Get in touch with our support team</p>
                </a>
              </Reveal>
              <Reveal variant="rise" delay={0.2}>
                <a
                  href="/community"
                  className="block bg-slate-700/50 rounded-xl p-6 border border-slate-600 hover:border-blue-500 transition text-center"
                >
                  <svg className="w-8 h-8 text-blue-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-white mb-2">Community</h3>
                  <p className="text-slate-400 text-sm">Join our Discord community</p>
                </a>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <a
                  href="/status"
                  className="block bg-slate-700/50 rounded-xl p-6 border border-slate-600 hover:border-blue-500 transition text-center"
                >
                  <svg className="w-8 h-8 text-blue-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-white mb-2">System Status</h3>
                  <p className="text-slate-400 text-sm">Check service status and uptime</p>
                </a>
              </Reveal>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

