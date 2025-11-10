'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'

const pressReleases = [
  {
    title: 'BullishAI Launches Real-Time Portfolio Analytics Platform',
    date: 'March 15, 2024',
    category: 'Product Launch',
    excerpt: 'BullishAI today announced the launch of its AI-powered portfolio analytics platform, featuring real-time market data, intelligent price alerts, and advanced charting capabilities.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
  },
  {
    title: 'Partnership with TradingView Brings Advanced Charting to Users',
    date: 'December 5, 2023',
    category: 'Partnership',
    excerpt: 'BullishAI partners with TradingView to integrate professional-grade charting tools, giving users access to advanced technical analysis and market visualization.',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
  },
  {
    title: 'BullishAI Introduces AI-Powered Investment Insights',
    date: 'November 20, 2023',
    category: 'Product Update',
    excerpt: 'New AI features provide personalized investment recommendations based on portfolio analysis, market trends, and risk assessment algorithms.',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80',
  },
]

export default function PressPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1920&q=80"
            alt="Press & Media"
            fill
            className="object-cover opacity-40"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900" />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Press & Media</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  Latest news, announcements, and media resources
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Press Releases */}
        <Reveal variant="fade">
          <div className="mb-12">
            <Reveal variant="rise">
              <h2 className="text-4xl font-bold text-white mb-2">Press Releases</h2>
              <p className="text-slate-400 mb-8">Stay updated with our latest announcements</p>
            </Reveal>
          </div>
        </Reveal>

        <div className="space-y-8 mb-16">
          {pressReleases.map((release, idx) => (
            <Reveal key={release.title} variant="fade" delay={idx * 0.1}>
              <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition-all">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="relative h-48 md:h-full min-h-[200px]">
                    <Image
                      src={release.image}
                      alt={release.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <div className="md:col-span-2 p-6 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-semibold rounded-full">
                        {release.category}
                      </span>
                      <span className="text-slate-500 text-sm">{release.date}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">{release.title}</h3>
                    <p className="text-slate-300 leading-relaxed">{release.excerpt}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Media Contact */}
        <Reveal variant="fade" delay={0.5}>
          <div className="bg-slate-800/50 rounded-2xl p-8 md:p-12 border border-slate-700">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">Media Contact</h2>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              <Reveal variant="rise" delay={0.1}>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Press Inquiries</h3>
                  <p className="text-slate-400 mb-4">
                    For media inquiries, interview requests, or press kit access, please contact our communications team.
                  </p>
                  <a
                    href="mailto:press@bullishai.com"
                    className="text-blue-400 hover:text-blue-300 transition"
                  >
                    press@bullishai.com
                  </a>
                </div>
              </Reveal>
              <Reveal variant="rise" delay={0.2}>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Brand Assets</h3>
                  <p className="text-slate-400 mb-4">
                    Download our logo, brand guidelines, and high-resolution images for media use.
                  </p>
                  <a
                    href="/brand-assets"
                    className="text-blue-400 hover:text-blue-300 transition"
                  >
                    Download Brand Kit →
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

