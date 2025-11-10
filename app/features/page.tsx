'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'

const features = [
  {
    title: 'Real-Time Market Data',
    description: 'Get live stock prices, market data, and portfolio updates with sub-second latency. Our infrastructure processes millions of data points to keep you informed 24/7.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80',
  },
  {
    title: 'AI-Powered Insights',
    description: 'Leverage advanced machine learning algorithms to receive personalized investment recommendations, trend analysis, and risk assessments tailored to your portfolio.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&q=80',
  },
  {
    title: 'Intelligent Price Alerts',
    description: 'Set custom alerts for price movements, volume spikes, and market events. Get notified instantly via email, SMS, or push notifications when your conditions are met.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=80',
  },
  {
    title: 'Advanced Portfolio Analytics',
    description: 'Track your portfolio performance with detailed analytics, mark-to-market valuations, cost basis tracking, and comprehensive return calculations across all your holdings.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80',
  },
  {
    title: 'Secure Data Storage',
    description: 'Your financial data is protected with bank-level encryption, secure authentication, and regular security audits. We never share your information with third parties.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&q=80',
  },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&q=80"
            alt="Features Dashboard"
            fill
            className="object-cover opacity-40"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900" />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Features</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  Everything you need to manage your portfolio with confidence
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Features Grid */}
        <div className="space-y-16">
          {features.map((feature, idx) => (
            <Reveal key={feature.title} variant="fade" delay={idx * 0.1}>
              <div className={`grid md:grid-cols-2 gap-12 items-center ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                <div className={idx % 2 === 1 ? 'md:order-2' : ''}>
                  <Reveal variant={idx % 2 === 0 ? 'slide-left' : 'slide-right'}>
                    <div className="relative h-64 md:h-80 rounded-xl overflow-hidden">
                      <Image
                        src={feature.image}
                        alt={feature.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>
                  </Reveal>
                </div>
                <div className={idx % 2 === 1 ? 'md:order-1' : ''}>
                  <Reveal variant={idx % 2 === 0 ? 'slide-right' : 'slide-left'}>
                    <div className="text-blue-400 mb-4">{feature.icon}</div>
                    <h2 className="text-3xl font-bold text-white mb-4">{feature.title}</h2>
                    <p className="text-slate-300 text-lg leading-relaxed">{feature.description}</p>
                  </Reveal>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* CTA Section */}
        <Reveal variant="fade" delay={0.6}>
          <div className="mt-20 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl p-12 border border-slate-700 text-center">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
            </Reveal>
            <Reveal variant="fade" delay={0.1}>
              <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
                Join thousands of investors using BullishAI to manage their portfolios with confidence.
              </p>
              <a
                href="/dashboard"
                className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition hover:scale-[0.98]"
              >
                Start Free Trial
              </a>
            </Reveal>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

