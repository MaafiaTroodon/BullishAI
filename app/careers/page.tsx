'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'

const benefits = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Hybrid Work',
    description: 'Work from home or our modern offices. Flexibility that fits your life.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Competitive Salary',
    description: 'Top-tier compensation packages with equity participation.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    title: 'Learning & Growth',
    description: 'Annual learning budget, conferences, and mentorship programs.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    title: 'Health & Wellness',
    description: 'Comprehensive health insurance, mental health support, and gym memberships.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Unlimited PTO',
    description: 'Take time off when you need it. We trust you to manage your work-life balance.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: '401(k) Matching',
    description: 'Plan for your future with our generous retirement savings program.',
  },
]

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[60vh] min-h-[500px] overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=80"
            alt="Modern Workspace"
            fill
            className="object-cover opacity-40"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900" />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Join Our Team</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  Build the future of AI-powered investing with world-class talent
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Why Join Section */}
        <Reveal variant="fade">
          <div className="mb-20">
            <Reveal variant="rise">
              <h2 className="text-4xl font-bold text-white mb-6 text-center">Why Join BullishAI?</h2>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-8 mt-12">
              <Reveal variant="slide-left" delay={0.1}>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-2xl font-semibold text-white mb-4">Innovation-Driven</h3>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    Work on cutting-edge AI and machine learning projects that are reshaping how people invest. You'll have the opportunity to build products used by millions of investors worldwide.
                  </p>
                  <p className="text-slate-400 leading-relaxed">
                    Our team is constantly exploring new technologies, from advanced prediction models to real-time data processing systems that handle billions of market events daily.
                  </p>
                </div>
              </Reveal>
              <Reveal variant="slide-right" delay={0.2}>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-2xl font-semibold text-white mb-4">Impact & Growth</h3>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    Join a fast-growing company where your contributions directly impact our product and users. We're building something meaningful in the fintech space, and every team member plays a crucial role.
                  </p>
                  <p className="text-slate-400 leading-relaxed">
                    With rapid growth comes rapid career advancement. We invest in our people and provide clear paths for professional development and leadership opportunities.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </Reveal>

        {/* Benefits Grid */}
        <Reveal variant="fade" delay={0.3}>
          <div className="mb-20">
            <Reveal variant="rise">
              <h2 className="text-4xl font-bold text-white mb-12 text-center">Benefits & Perks</h2>
            </Reveal>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((benefit, idx) => (
                <Reveal key={benefit.title} variant="rise" delay={idx * 0.05}>
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all">
                    <div className="text-blue-400 mb-4">{benefit.icon}</div>
                    <h3 className="text-xl font-semibold text-white mb-2">{benefit.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{benefit.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Open Positions CTA */}
        <Reveal variant="fade" delay={0.4}>
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl p-12 border border-slate-700 text-center">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-4">Ready to Build the Future?</h2>
            </Reveal>
            <Reveal variant="fade" delay={0.1}>
              <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
                We're always looking for talented engineers, designers, and product managers who are passionate about fintech and AI. Even if you don't see a perfect match, we'd love to hear from you.
              </p>
              <a
                href="mailto:careers@bullishai.com"
                className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition hover:scale-[0.98]"
              >
                Get in Touch
              </a>
            </Reveal>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

