'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'

const founderHighlights = [
  'Computer Science student at Dalhousie University with a strong focus on software engineering and applied AI.',
  'Actively building real-world projects across full-stack development, systems, and data-driven applications.',
  'Student Software & Application Developer passionate about AI-driven products and real-world problem solving.',
  'Building full-stack platforms like BullishAI, blending engineering, data, and design to make investing smarter and more accessible.',
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

      {/* Team Spotlight */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Reveal variant="fade">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Founder Spotlight</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              The product vision and engineering leadership behind BullishAI.
            </p>
          </div>
        </Reveal>

        <Reveal variant="rise">
          <div className="bg-slate-800/60 rounded-2xl p-6 md:p-10 border border-slate-700 shadow-lg shadow-blue-500/10">
            <div className="grid md:grid-cols-[280px_1fr] gap-8 items-center">
              <div className="relative w-56 h-80 md:w-64 md:h-[22rem] mx-auto rounded-2xl overflow-hidden border border-slate-700 bg-slate-900/40">
                <Image
                  src="/configs/images/malhar-profile.jpg"
                  alt="Malhar Mahajan"
                  fill
                  className="object-contain object-center"
                  sizes="(max-width: 768px) 224px, 256px"
                />
              </div>
              <div>
                <h3 className="text-3xl font-semibold text-white mb-2">Malhar Mahajan</h3>
                <p className="text-blue-400 text-base font-medium mb-5">Founder & Lead Developer</p>
                <div className="space-y-3">
                  {founderHighlights.map((point) => (
                    <div key={point} className="flex gap-3 text-slate-300 leading-relaxed">
                      <span className="mt-2 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                      <p>{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>

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
