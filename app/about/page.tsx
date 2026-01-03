'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[60vh] min-h-[500px] overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&q=80"
            alt="Finance Dashboard"
            fill
            className="object-cover opacity-40"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900" />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Our Story</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  Empowering investors with AI-driven insights and real-time portfolio analytics
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Content Sections */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Profile */}
        <Reveal variant="fade" delay={0.05}>
          <div className="mb-20">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <Reveal variant="slide-right" delay={0.15}>
                <div className="relative h-64 md:h-80 rounded-xl overflow-hidden order-2 md:order-1">
                  <Image
                    src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=900&q=80"
                    alt="Creative portfolio backdrop"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </Reveal>
              <div className="order-1 md:order-2">
                <Reveal variant="slide-left">
                  <h2 className="text-3xl font-bold text-white mb-3">Malhar Datta Mahajan</h2>
                </Reveal>
                <Reveal variant="fade" delay={0.1}>
                  <p className="text-slate-300 text-lg mb-4">Software Developer • Halifax, NS</p>
                  <p className="text-slate-400 leading-relaxed mb-6">
                    Connect with me to learn more about my work, projects, and experience on my portfolio website.
                  </p>
                  <a
                    href="https://portfoliomalhar.netlify.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
                  >
                    View Portfolio
                  </a>
                </Reveal>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Mission */}
        <Reveal variant="fade" delay={0.1}>
          <div className="mb-20">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <Reveal variant="slide-left">
                  <h2 className="text-3xl font-bold text-white mb-4">Our Mission</h2>
                </Reveal>
                <Reveal variant="fade" delay={0.1}>
                  <p className="text-slate-300 text-lg leading-relaxed mb-4">
                    BullishAI was founded on a simple belief: every investor deserves access to professional-grade tools and insights. We combine cutting-edge artificial intelligence with real-time market data to deliver a platform that helps you make informed decisions, track your portfolio with precision, and stay ahead of market trends.
                  </p>
                  <p className="text-slate-400 leading-relaxed">
                    Our mission is to democratize sophisticated financial analytics, making advanced portfolio management accessible to investors at every level—from beginners to seasoned traders.
                  </p>
                </Reveal>
              </div>
              <Reveal variant="slide-right" delay={0.2}>
                <div className="relative h-64 md:h-80 rounded-xl overflow-hidden">
                  <Image
                    src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80"
                    alt="Financial Analytics"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </Reveal>
            </div>
          </div>
        </Reveal>

        {/* Innovation */}
        <Reveal variant="fade" delay={0.2}>
          <div className="mb-20">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <Reveal variant="slide-left" delay={0.1}>
                <div className="relative h-64 md:h-80 rounded-xl overflow-hidden order-2 md:order-1">
                  <Image
                    src="https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80"
                    alt="AI Technology"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </Reveal>
              <div className="order-1 md:order-2">
                <Reveal variant="slide-right">
                  <h2 className="text-3xl font-bold text-white mb-4">Innovation at Our Core</h2>
                </Reveal>
                <Reveal variant="fade" delay={0.1}>
                  <p className="text-slate-300 text-lg leading-relaxed mb-4">
                    We leverage state-of-the-art AI models and machine learning algorithms to analyze market patterns, predict trends, and provide actionable insights. Our platform processes millions of data points in real-time, delivering personalized recommendations tailored to your investment strategy.
                  </p>
                  <p className="text-slate-400 leading-relaxed">
                    From intelligent price alerts to comprehensive portfolio analytics, every feature is designed with one goal: to give you the edge you need in today's fast-paced markets.
                  </p>
                </Reveal>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Trust */}
        <Reveal variant="fade" delay={0.3}>
          <div className="bg-slate-800/50 rounded-2xl p-8 md:p-12 border border-slate-700">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">Trust in AI Investing</h2>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-8">
              <Reveal variant="rise" delay={0.1}>
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Secure & Reliable</h3>
                  <p className="text-slate-400">
                    Bank-level encryption and security protocols protect your data and transactions
                  </p>
                </div>
              </Reveal>
              <Reveal variant="rise" delay={0.2}>
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Real-Time Data</h3>
                  <p className="text-slate-400">
                    Live market data and instant updates keep you informed 24/7
                  </p>
                </div>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">AI-Powered Insights</h3>
                  <p className="text-slate-400">
                    Advanced algorithms analyze patterns and deliver personalized recommendations
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
