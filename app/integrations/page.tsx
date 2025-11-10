'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'

const integrations = [
  {
    name: 'TradingView',
    description: 'Professional-grade charting and technical analysis tools integrated directly into your dashboard.',
    logo: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=200&q=80',
  },
  {
    name: 'Groq AI',
    description: 'Lightning-fast AI inference for real-time market analysis and investment recommendations.',
    logo: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=200&q=80',
  },
  {
    name: 'NeonDB',
    description: 'Serverless Postgres database powering our real-time portfolio tracking and analytics.',
    logo: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=200&q=80',
  },
  {
    name: 'Twelve Data',
    description: 'Real-time and historical market data feeds for stocks, forex, and cryptocurrencies.',
    logo: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=200&q=80',
  },
  {
    name: 'Alpha Vantage',
    description: 'Premium financial data APIs for fundamental analysis and market insights.',
    logo: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=200&q=80',
  },
  {
    name: 'Finnhub',
    description: 'Stock market data, news, and sentiment analysis for comprehensive market intelligence.',
    logo: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=200&q=80',
  },
]

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[40vh] min-h-[300px] overflow-hidden bg-gradient-to-br from-blue-900/20 via-slate-900 to-purple-900/20">
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Integrations</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  Powered by industry-leading partners
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Partners Grid */}
        <Reveal variant="fade">
          <div className="mb-12">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-4 text-center">Our Technology Partners</h2>
              <p className="text-slate-400 text-center max-w-2xl mx-auto mb-12">
                BullishAI integrates with best-in-class services to deliver a comprehensive investment platform.
              </p>
            </Reveal>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {integrations.map((integration, idx) => (
            <Reveal key={integration.name} variant="rise" delay={idx * 0.1}>
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-blue-500/10">
                <div className="relative w-20 h-20 mx-auto mb-4 rounded-lg overflow-hidden">
                  <Image
                    src={integration.logo}
                    alt={integration.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
                <h3 className="text-xl font-semibold text-white text-center mb-2">{integration.name}</h3>
                <p className="text-slate-400 text-sm text-center leading-relaxed">{integration.description}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Custom Integrations */}
        <Reveal variant="fade" delay={0.5}>
          <div className="bg-slate-800/50 rounded-2xl p-8 md:p-12 border border-slate-700">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">Need a Custom Integration?</h2>
            </Reveal>
            <Reveal variant="fade" delay={0.1}>
              <p className="text-slate-300 text-center mb-8 max-w-2xl mx-auto">
                Our Enterprise plans include custom integration support. Connect BullishAI with your existing tools, 
                trading platforms, or internal systems.
              </p>
              <div className="text-center">
                <a
                  href="/contact"
                  className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition hover:scale-[0.98]"
                >
                  Contact Sales
                </a>
              </div>
            </Reveal>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

