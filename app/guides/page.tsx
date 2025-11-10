'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'

const guides = [
  {
    title: 'How to Build an AI Portfolio Tracker',
    description: 'Step-by-step guide to creating your own portfolio tracking application using BullishAI\'s API and AI insights.',
    image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80',
    category: 'Development',
  },
  {
    title: 'Using Alerts Effectively',
    description: 'Master price alerts to stay informed about market movements and never miss important trading opportunities.',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=80',
    category: 'Tutorial',
  },
  {
    title: 'Portfolio Diversification Strategies',
    description: 'Learn how to analyze and improve your portfolio diversification using BullishAI\'s analytics tools.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80',
    category: 'Investing',
  },
  {
    title: 'Understanding Market Sessions',
    description: 'Navigate pre-market, regular trading hours, and after-hours sessions with confidence.',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80',
    category: 'Education',
  },
  {
    title: 'API Integration Best Practices',
    description: 'Learn how to efficiently integrate BullishAI\'s API into your applications with proper error handling and rate limiting.',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&q=80',
    category: 'Development',
  },
  {
    title: 'Maximizing Portfolio Returns',
    description: 'Advanced strategies for optimizing your portfolio performance using AI-powered insights and analytics.',
    image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=80',
    category: 'Investing',
  },
]

export default function GuidesPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[40vh] min-h-[300px] overflow-hidden bg-gradient-to-br from-blue-900/20 via-slate-900 to-purple-900/20">
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Guides & Tutorials</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  Learn how to get the most out of BullishAI
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Guides Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {guides.map((guide, idx) => (
            <Reveal key={guide.title} variant="rise" delay={idx * 0.05}>
              <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition-all cursor-pointer group">
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src={guide.image}
                    alt={guide.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
                <div className="p-6">
                  <span className="inline-block px-3 py-1 bg-purple-600/20 text-purple-400 text-xs font-semibold rounded-full mb-3">
                    {guide.category}
                  </span>
                  <h2 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition">
                    {guide.title}
                  </h2>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">{guide.description}</p>
                  <span className="text-blue-400 text-sm font-semibold group-hover:translate-x-1 transition inline-block">
                    Read guide →
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Featured Guide */}
        <Reveal variant="fade" delay={0.5}>
          <div className="mt-16 bg-slate-800/50 rounded-2xl p-8 md:p-12 border border-slate-700">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <Reveal variant="slide-left">
                <div className="relative h-64 md:h-80 rounded-xl overflow-hidden">
                  <Image
                    src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80"
                    alt="Featured Guide"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </Reveal>
              <Reveal variant="slide-right">
                <div>
                  <span className="inline-block px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-semibold rounded-full mb-4">
                    Featured
                  </span>
                  <h2 className="text-3xl font-bold text-white mb-4">Getting Started with BullishAI</h2>
                  <p className="text-slate-300 leading-relaxed mb-6">
                    New to BullishAI? This comprehensive guide will walk you through setting up your account, 
                    adding your first positions, and using our AI-powered features to track and optimize your portfolio.
                  </p>
                  <a
                    href="#"
                    className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                  >
                    Read Full Guide
                  </a>
                </div>
              </Reveal>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

