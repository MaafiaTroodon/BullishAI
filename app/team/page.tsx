'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'

const teamMembers = [
  {
    name: 'Sarah Chen',
    role: 'CEO & Co-Founder',
    bio: 'Former VP at Goldman Sachs with 15+ years in fintech. Led AI initiatives at major financial institutions.',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
  },
  {
    name: 'Marcus Rodriguez',
    role: 'CTO & Co-Founder',
    bio: 'Ex-Google engineer specializing in real-time systems and machine learning. Built trading platforms handling billions in volume.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
  },
  {
    name: 'Priya Patel',
    role: 'Head of AI Research',
    bio: 'PhD in Machine Learning from MIT. Published 30+ papers on financial prediction models and algorithmic trading.',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80',
  },
  {
    name: 'David Kim',
    role: 'Head of Product',
    bio: 'Product leader with experience at Robinhood and Coinbase. Passionate about making finance accessible to everyone.',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80',
  },
  {
    name: 'Emily Watson',
    role: 'Head of Engineering',
    bio: 'Full-stack architect with expertise in high-performance systems. Previously scaled infrastructure at Stripe.',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80',
  },
  {
    name: 'James Thompson',
    role: 'Head of Security',
    bio: 'Cybersecurity expert with 20+ years protecting financial systems. Former security lead at JPMorgan Chase.',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
  },
]

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=80"
            alt="Team Collaboration"
            fill
            className="object-cover opacity-40"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900" />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Our Team</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  World-class talent building the future of AI-powered investing
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Team Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Reveal variant="fade">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Leadership</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Our team brings together decades of experience from leading financial institutions, tech companies, and research labs.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {teamMembers.map((member, idx) => (
            <Reveal key={member.name} variant="rise" delay={idx * 0.1}>
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-blue-500/10">
                <div className="relative w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
                <h3 className="text-xl font-semibold text-white text-center mb-1">{member.name}</h3>
                <p className="text-blue-400 text-sm text-center mb-3">{member.role}</p>
                <p className="text-slate-400 text-sm leading-relaxed text-center">{member.bio}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Culture Section */}
        <Reveal variant="fade" delay={0.5}>
          <div className="mt-20 bg-slate-800/50 rounded-2xl p-8 md:p-12 border border-slate-700">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">Our Culture</h2>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-8">
              <Reveal variant="rise" delay={0.1}>
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Collaboration</h3>
                  <p className="text-slate-400 text-sm">
                    We believe the best products come from diverse teams working together
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
                  <h3 className="text-lg font-semibold text-white mb-2">Innovation</h3>
                  <p className="text-slate-400 text-sm">
                    We're constantly pushing boundaries in AI and financial technology
                  </p>
                </div>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Impact</h3>
                  <p className="text-slate-400 text-sm">
                    We're building tools that empower millions of investors worldwide
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

